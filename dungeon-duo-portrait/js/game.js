(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const TAU = Math.PI * 2;

  // --- Maze geometry constants -------------------------------------------------
  const CELL_SIZE = 540;
  const WALL_THICK = 30;
  const CORRIDOR_LEN = 400;
  const MAZE_MARGIN = 240;
  const BOSS_ARENA_SIZE = { w: 1950, h: 1500 };
  const DIRS = [['N', 0, -1, 'S'], ['S', 0, 1, 'N'], ['E', 1, 0, 'W'], ['W', -1, 0, 'E']];

  const TETHER = { soft: 760, max: 1020 };
  const COLORS = {
    p1: '#5bd6ff', p2: '#ff7bca', enemy: '#ff6b68', elite: '#ffb449', boss: '#b88cff',
    warning: 'rgba(255,210,79,.24)', danger: 'rgba(255,88,102,.25)', heal: '#6ef2a2', upgrade: '#b998ff'
  };

  const BIOMES = [
    { name:'Stone Dungeon', floor:'#141a29', floor2:'#1a2233', wall:'#3a4359', edge:'#68728c', void:'#070a12', accent:'#8b9bbf', pattern:'grid' },
    { name:'Frozen Crypt', floor:'#10222d', floor2:'#183542', wall:'#365a68', edge:'#9dd9ea', void:'#061017', accent:'#70d8ff', pattern:'crystal' },
    { name:'Lava Forge', floor:'#281719', floor2:'#3a2020', wall:'#67413c', edge:'#ff9c54', void:'#120607', accent:'#ff6f3c', pattern:'crack' },
    { name:'Poison Swamp', floor:'#172219', floor2:'#223225', wall:'#42583e', edge:'#9add65', void:'#071008', accent:'#73d65c', pattern:'pool' },
    { name:'Haunted Library', floor:'#21172b', floor2:'#30203c', wall:'#5c496a', edge:'#d8adff', void:'#0c0710', accent:'#b88cff', pattern:'rune' },
    { name:'Crystal Cave', floor:'#111d2c', floor2:'#172b3e', wall:'#395b73', edge:'#9ef3ff', void:'#050b12', accent:'#6ce3ff', pattern:'crystal' },
    { name:'Mechanical Fortress', floor:'#171b20', floor2:'#252b31', wall:'#515b63', edge:'#ffd36f', void:'#080a0c', accent:'#f0b94f', pattern:'gear' },
    { name:'Shadow Realm', floor:'#17131f', floor2:'#241b31', wall:'#453657', edge:'#e37cff', void:'#060408', accent:'#d65cff', pattern:'rune' }
  ];

  const LEVEL_MODIFIERS = [
    { id:'reinforced', name:'Reinforced Host', desc:'Musuh memiliki 18% HP tambahan.', enemyHp:1.18 },
    { id:'frenzy', name:'Frenzied Rhythm', desc:'Musuh menyerang 14% lebih sering.', enemyCooldown:.86 },
    { id:'swift', name:'Swift Projectiles', desc:'Projectile musuh 22% lebih cepat.', projectileSpeed:1.22 },
    { id:'scarce', name:'Scarce Mercy', desc:'Pemulihan antar-wave berkurang.', heal:0.65 },
    { id:'elite', name:'Elite Convergence', desc:'Enemy modifier dan elite lebih sering muncul.', modifierBonus:.22 },
    { id:'resonance', name:'Co-op Resonance', desc:'Musuh lebih kuat, tetapi duo dekat memberi +15% damage.', enemyHp:1.12, closeDamage:.15 }
  ];

  const dom = {
    start: document.getElementById('start-screen'), upgrade: document.getElementById('upgrade-screen'), gameOver: document.getElementById('game-over-screen'),
    victory: document.getElementById('victory-screen'),
    startButton: document.getElementById('start-button'), continueButton: document.getElementById('continue-button'), restartRun: document.getElementById('restart-run-button'),
    restartLevel: document.getElementById('restart-level-button'), sound: document.getElementById('sound-enabled'), soundToggle: document.getElementById('sound-toggle-button'), level: document.getElementById('level-label'),
    objective: document.getElementById('objective'), modifier: document.getElementById('level-modifier'), finalScore: document.getElementById('final-score'), toast: document.getElementById('toast'),
    p1Hp: document.getElementById('p1-hp'), p2Hp: document.getElementById('p2-hp'), p1Shield: document.getElementById('p1-shield'), p2Shield: document.getElementById('p2-shield'),
    p1Text: document.getElementById('p1-hp-text'), p2Text: document.getElementById('p2-hp-text'), p1State: document.getElementById('p1-state'), p2State: document.getElementById('p2-state'),
    p1Build: document.getElementById('p1-build'), p2Build: document.getElementById('p2-build'), p1Upgrades: document.getElementById('p1-upgrades'), p2Upgrades: document.getElementById('p2-upgrades'),
    upgradeStatus: document.getElementById('upgrade-status'), upgradeEyebrow: document.getElementById('upgrade-eyebrow'), upgradeTitle: document.getElementById('upgrade-title'),
    upgradeDescription: document.getElementById('upgrade-description'), fullscreenButton: document.getElementById('fullscreen-button'), tetherWarning: document.getElementById('tether-warning'),
    victoryTitle: document.getElementById('victory-title'), victoryDetail: document.getElementById('victory-detail'), victoryStats: document.getElementById('victory-stats'),
    victoryContinue: document.getElementById('victory-continue-button'),
    powerup: document.getElementById('powerup-screen'), powerupTitle: document.getElementById('powerup-title'),
    powerupOptions: document.getElementById('powerup-options'), powerupReroll: document.getElementById('powerup-reroll-button')
  };

  const input = {
    pointers: new Map(),
    sticks: [createStick(W * .17, H * .85), createStick(W * .83, H * .85)],
    keys: new Set()
  };

  let state = createInitialState();
  let lastTime = performance.now();
  let toastTimer = 0;
  let enemyUid = 1;

  function createStick(x, y) {
    return { active:false, pointerId:null, origin:{x,y}, knob:{x,y}, vector:{x:0,y:0}, radius:68 };
  }

  function createInitialState() {
    return {
      running:false, paused:true, level:1, score:0, difficulty:1, seed:Date.now()%1000000,
      players:[], enemies:[], projectiles:[], enemyProjectiles:[], effects:[], pickups:[], obstacles:[], pits:[], hazards:[], spawnQueue:[],
      phase:'idle', phaseTimer:0, upgradeSelections:[false,false], shake:0, biome:'Stone Dungeon', theme:BIOMES[0],
      levelModifier:null, tetherWarning:false, hazardClock:0, gateBlockedCooldown:0,
      maze:null, levelKills:0, gateTriggered:false, goalAnnounced:false, pendingBossName:null,
      delayedShots:[], delayedTasks:[], ambushTimer:20, activePowerupPlayer:null, powerupRerollsLeft:0,
      camera:{x:0,y:0,zoom:.78,targetZoom:.78}
    };
  }

  function createPlayer(id, x, y, color) {
    return {
      id,x,y,r:22,color,maxHp:100,hp:100,speed:210,facing:id===1?{x:1,y:0}:{x:-1,y:0},moving:false,move:{x:0,y:0},
      attackState:'idle',attackTimer:0,attackCooldown:0,attackCycle:.6,target:null,downed:false,reviveProgress:0,invuln:0,upgrades:[],
      meleeDamage:22,rangedDamage:14,meleeRange:62,rangedRange:300,meleeAngle:deg(110),rangedAngle:deg(60),projectileSpeed:520,
      critChance:0,multishot:1,pierce:0,regen:0,damageReduction:0,lifesteal:0,detectorScale:1,thorns:0,
      maxShield:0,shield:0,shieldRegen:0,shieldDelay:0,deathProtection:0,deathProtectionMax:0,
      projectileStyle:'arcane',projectileScale:1,burnPower:0,slowPower:0,poisonPower:0,chainCount:0,explosiveRadius:0,homing:0,ricochet:0,
      meleeShockwave:0,doubleSlash:0,orbitBlade:0,orbitAngle:id===1?0:Math.PI,orbitTimer:0,closeDamageBonus:0,closeShieldRegen:0,
      sideShots:0,rearShots:0,volleyCount:0,knockback:0,auraDamage:0,auraRadius:0,pulseBlast:0,pulseTimer:0,
      rearMelee:0,whirlwind:false,meleeBounce:0,executeThreshold:0,executeBonus:0,
      arcDischarge:0,arcTimer:0,splitShots:0,boomerang:false,retaliation:0,retaliationCooldown:0,
      frostNova:0,frostNovaCooldown:0,magnetRadius:0,adrenalineGain:false,adrenalineStacks:0,adrenalineTimer:0,
      lastCrit:false,debuffSlowTimer:0,debuffSlowAmount:0,weakenTimer:0,weakenAmount:0,ambushWarningTimer:0,
      visual:{fire:false,ice:false,poison:false,lightning:false,shield:false,speedTrail:false,armor:false,heavyWeapon:false,projectileCrown:false}
    };
  }

  const UPGRADE_POOL = [
    upgrade('Tempered Edge','+7 melee damage.','Melee',p=>{p.meleeDamage+=7;p.visual.heavyWeapon=true;}),
    upgrade('Long Reach','+18 melee range.','Melee',p=>p.meleeRange+=18),
    upgrade('Double Slash','Melee menghasilkan tebasan kedua 55% damage.','Melee',p=>p.doubleSlash=Math.min(2,p.doubleSlash+1)),
    upgrade('Seismic Edge','Melee memancarkan shockwave 42% damage.','Melee',p=>p.meleeShockwave=Math.min(.8,p.meleeShockwave+.42)),
    upgrade('Vampiric Steel','Melee lifesteal +6%.','Melee',p=>p.lifesteal=Math.min(.24,p.lifesteal+.06)),
    upgrade('Heavy Bolt','+5 ranged damage.','Ranged',p=>p.rangedDamage+=5),
    upgrade('Focus Lens','+45 ranged range dan +4° cone.','Ranged',p=>{p.rangedRange+=45;p.rangedAngle+=deg(4);}),
    upgrade('Twin Shot','+1 projectile. Damage dibagi agar total hanya naik moderat.','Ranged',p=>{p.multishot=Math.min(5,p.multishot+1);p.visual.projectileCrown=true;}),
    upgrade('Piercing Rune','Projectile menembus +1 target.','Ranged',p=>p.pierce+=1),
    upgrade('Homing Sigil','Projectile membelok ringan menuju target.','Ranged',p=>p.homing=Math.min(.2,p.homing+.07)),
    upgrade('Ricochet Core','Projectile memantul sekali dari obstacle.','Ranged',p=>p.ricochet=Math.min(3,p.ricochet+1)),
    upgrade('Volatile Orb','Projectile meledak dan memberi 42% splash damage.','Ranged',p=>{p.explosiveRadius=Math.max(82,p.explosiveRadius+14);p.projectileStyle='explosive';p.projectileScale=Math.max(1.18,p.projectileScale);}),
    upgrade('Overcharged Core','+3 ranged damage dan projectile 24% lebih besar.','Ranged',p=>{p.rangedDamage+=3;p.projectileScale*=1.24;}),
    upgrade('Quick Rhythm','Attack cycle 10% lebih cepat.','Tempo',p=>p.attackCycle=Math.max(.3,p.attackCycle*.9)),
    upgrade('Critical Focus','Critical chance +10%.','Damage',p=>p.critChance=Math.min(.5,p.critChance+.1)),
    upgrade('Ember Weapon','Serangan membakar target; projectile berubah menjadi api.','Element',p=>{p.burnPower+=3.2;p.projectileStyle='fire';p.visual.fire=true;}),
    upgrade('Frost Weapon','Serangan memperlambat target; projectile menjadi kristal es.','Element',p=>{p.slowPower=Math.min(.5,p.slowPower+.18);p.projectileStyle='ice';p.visual.ice=true;}),
    upgrade('Venom Weapon','Serangan memberi poison damage-over-time.','Element',p=>{p.poisonPower+=2.4;p.projectileStyle='poison';p.visual.poison=true;}),
    upgrade('Storm Conduit','Projectile menyambar 1 musuh tambahan dengan damage menurun.','Element',p=>{p.chainCount=Math.min(3,p.chainCount+1);p.projectileStyle='lightning';p.visual.lightning=true;}),
    upgrade('Vital Core','+24 max HP dan memulihkan 24 HP.','Defense',p=>{p.maxHp+=24;p.hp=Math.min(p.maxHp,p.hp+24);state.effects.push({type:'healBurst',x:p.x,y:p.y,t:.5,max:.5,color:'#78efa4'});}),
    upgrade('Guardian Aegis','Mendapat 35 shield yang beregenerasi setelah tidak terkena serangan.','Defense',p=>addShield(p,35,4)),
    upgrade('Crystal Barrier','+20 max shield dan +2 shield regen/detik.','Defense',p=>addShield(p,20,2)),
    upgrade('Guardian Plate','Damage reduction +8% dan armor terlihat.','Defense',p=>{p.damageReduction=Math.min(.4,p.damageReduction+.08);p.visual.armor=true;}),
    upgrade('Second Wind','Regenerasi 1.2 HP/detik.','Defense',p=>p.regen+=1.2),
    upgrade('Emergency Sigil','Sekali per level, selamat dari serangan fatal dengan 25% HP.','Defense',p=>{p.deathProtectionMax+=1;p.deathProtection=p.deathProtectionMax;}),
    upgrade('Thorn Mail','Penyerang melee menerima 18% damage yang diberikan.','Defense',p=>p.thorns=Math.min(.5,p.thorns+.18)),
    upgrade('Fleet Step','+24 move speed dan meninggalkan trail.','Movement',p=>{p.speed+=24;p.visual.speedTrail=true;}),
    upgrade('Arc Lens','Cone detector +10%.','Utility',p=>p.detectorScale=Math.min(1.45,p.detectorScale*1.1)),
    upgrade('Orbiting Blade','Menambahkan blade yang mengorbit dan melukai musuh dekat.','Special',p=>p.orbitBlade=Math.min(3,p.orbitBlade+1)),
    upgrade('Duo Resonance','Saat partner berdekatan, damage +12%.','Co-op',p=>p.closeDamageBonus+=.12),
    upgrade('Linked Ward','Saat partner berdekatan, shield regen +2/detik.','Co-op',p=>{p.closeShieldRegen+=2;if(!p.maxShield)addShield(p,18,1);}),
    upgrade('Flank Cannons','+2 projectile menembak lurus ke samping kiri dan kanan (45% damage).','Ranged',p=>p.sideShots=Math.min(2,p.sideShots+1)),
    upgrade('Rear Guard','+1 projectile menembak ke belakang untuk jaga jarak (40% damage).','Ranged',p=>p.rearShots=Math.min(2,p.rearShots+1)),
    upgrade('Rapid Volley','Tembakan utama diikuti gelombang susulan berulang (80% damage).','Ranged',p=>p.volleyCount=Math.min(2,p.volleyCount+1)),
    upgrade('Heavy Knuckles','Melee mendorong musuh menjauh.','Melee',p=>p.knockback=Math.min(110,p.knockback+36)),
    upgrade('Static Field','Aura pasif melukai musuh di sekitar setiap saat.','Special',p=>{p.auraDamage=(p.auraDamage||0)+4;p.auraRadius=Math.max(p.auraRadius||0,95);}),
    upgrade('Concussive Core','Memancarkan ledakan area yang mendorong dan melukai musuh di sekitar secara berkala.','Special',p=>p.pulseBlast=Math.min(3,p.pulseBlast+1)),
    upgrade('Reverse Slash','Melee juga menebas musuh di belakang (60% damage).','Melee',p=>p.rearMelee=Math.min(1,p.rearMelee+1)),
    upgrade('Whirlwind Cleave','Melee menjadi putaran 360° yang mengenai semua musuh di sekitar.','Melee',p=>p.whirlwind=true),
    upgrade('Blade Bounce','Melee memantul ke musuh terdekat lainnya (55% damage berantai).','Melee',p=>p.meleeBounce=Math.min(2,p.meleeBounce+1)),
    upgrade('Executioner','Melee memberi +80% damage ke musuh di bawah 25% HP.','Melee',p=>{p.executeThreshold=.25;p.executeBonus=(p.executeBonus||0)+.8;}),
    upgrade('Arc Discharge','Menyambar musuh terdekat dengan petir secara berkala tanpa perlu menyerang.','Special',p=>p.arcDischarge=Math.min(3,p.arcDischarge+1)),
    upgrade('Split Arrow','Tembakan utama pecah menjadi 2 pecahan saat mengenai musuh pertama.','Ranged',p=>p.splitShots=Math.min(2,p.splitShots+1)),
    upgrade('Boomerang Rounds','Projectile yang tidak mengenai apapun akan kembali melewati posisi kalian.','Ranged',p=>p.boomerang=true),
    upgrade('Spectral Retaliation','Saat terkena serangan, membalas penyerang dengan proyektil arwah.','Defense',p=>p.retaliation=Math.min(3,p.retaliation+1)),
    upgrade('Frost Nova','Saat terkena serangan, memancarkan nova beku yang memperlambat musuh sekitar.','Defense',p=>p.frostNova=Math.min(3,p.frostNova+1)),
    upgrade('Magnetic Field','Menarik item di sekitar mendekat secara otomatis.','Utility',p=>p.magnetRadius=Math.min(320,(p.magnetRadius||0)+160)),
    upgrade('Adrenaline Surge','Membunuh musuh memberi speed dan attack speed sementara yang menumpuk.','Movement',p=>p.adrenalineGain=true)
  ];

  function upgrade(name, desc, tag, apply) { return {name,desc,tag,apply}; }
  function addShield(p, amount, regen) {
    p.maxShield += amount;
    p.shield = Math.min(p.maxShield, p.shield + amount);
    p.shieldRegen += regen;
    p.visual.shield = true;
  }

  function beginRun(fromCheckpoint=false) {
    window.GameAudio.unlock();
    window.GameAudio.setEnabled(dom.sound.checked);
    updateSoundButton();
    dom.start.classList.remove('visible');
    dom.gameOver.classList.remove('visible');
    dom.upgrade.classList.remove('visible');
    dom.victory.classList.remove('visible');
    dom.powerup.classList.remove('visible');
    state=createInitialState();
    if(fromCheckpoint){
      const saved=loadCheckpoint();
      if(saved){
        state.level=saved.level||1;state.score=saved.score||0;state.difficulty=saved.difficulty||1;state.seed=saved.seed||state.seed;
        state.players=(saved.players||[]).map((savedPlayer,i)=>{const base=createPlayer(i+1,0,0,i?COLORS.p2:COLORS.p1);const defaultVisual={...base.visual};const merged=Object.assign(base,savedPlayer,{x:0,y:0,downed:false,hp:savedPlayer.maxHp||100,attackState:'idle',target:null});merged.visual=Object.assign(defaultVisual,savedPlayer.visual||{});return merged;});
      }
    }
    if(!state.players.length)state.players=[createPlayer(1,0,0,COLORS.p1),createPlayer(2,0,0,COLORS.p2)];
    state.running=true;
    startLevel();
  }

  function startLevel(restart=false) {
    state.paused=false;state.phase='levelIntro';state.phaseTimer=2.2;
    state.enemies.length=0;state.projectiles.length=0;state.enemyProjectiles.length=0;state.pickups.length=0;state.effects.length=0;state.spawnQueue.length=0;state.delayedShots.length=0;state.delayedTasks.length=0;state.ambushTimer=13+Math.random()*8;
    state.theme=BIOMES[(state.level-1)%BIOMES.length];state.biome=state.theme.name;state.levelModifier=modifierForLevel(state.level,state.seed);
    state.maze=generateMaze(state.level,state.seed);
    state.obstacles=state.maze.wallObstacles;
    state.pits=state.maze.pits;state.hazards=state.maze.hazards;state.hazardClock=0;state.gateBlockedCooldown=0;
    state.levelKills=0;state.gateTriggered=false;state.goalAnnounced=false;state.pendingBossName=null;
    state.players.forEach((p,i)=>{
      const start=state.maze.playerStarts[i];
      p.x=start.x;p.y=start.y;p.hp=Math.max(1,Math.min(p.maxHp,p.hp));p.shield=p.maxShield;
      p.downed=false;p.reviveProgress=0;p.invuln=2.5;p.attackState='idle';p.target=null;p.deathProtection=p.deathProtectionMax||p.deathProtection||0;
    });
    placePlayersSafely();
    const midpoint=midpointOfPlayers();state.camera={x:midpoint.x,y:midpoint.y,zoom:.78,targetZoom:.78};
    saveCheckpoint();
	// Hentikan sistem musik lama jika masih aktif.
	window.GameAudio?.stopMusic?.();

	// Pilih musik dungeon berdasarkan level.
	// Restart level yang sama tidak akan mengacak ulang musik.
	window.DungeonMusic.playDungeon(state.level);
    showToast(restart?'Level diulang dengan difficulty assist':`${state.biome} · Level ${state.level}`);updateHud();
  }

  function modifierForLevel(level, seed) {
    if(level<3)return null;
    const rand=mulberry32(seed+level*991);
    return LEVEL_MODIFIERS[Math.floor(rand()*LEVEL_MODIFIERS.length)];
  }

  function snapshotPlayers() {
    const keys=['maxHp','speed','meleeDamage','rangedDamage','meleeRange','rangedRange','meleeAngle','rangedAngle','projectileSpeed','attackCycle','critChance','multishot','pierce','regen','damageReduction','lifesteal','detectorScale','thorns','maxShield','shieldRegen','deathProtection','deathProtectionMax','projectileStyle','projectileScale','burnPower','slowPower','poisonPower','chainCount','explosiveRadius','homing','ricochet','meleeShockwave','doubleSlash','orbitBlade','closeDamageBonus','closeShieldRegen','sideShots','rearShots','volleyCount','knockback','auraDamage','auraRadius','pulseBlast','rearMelee','whirlwind','meleeBounce','executeThreshold','executeBonus','arcDischarge','splitShots','boomerang','retaliation','frostNova','magnetRadius','adrenalineGain'];
    return state.players.map(p=>{
      const out={hp:p.maxHp,upgrades:[...p.upgrades],visual:{...p.visual}};
      keys.forEach(k=>out[k]=p[k]);
      return out;
    });
  }

  // --- Maze generation -----------------------------------------------------

  function generateMaze(level, seed) {
    const rand=mulberry32(seed+level*4211);
    const cols=clamp(7+Math.floor(level/2),7,12);
    const rows=clamp(6+Math.floor(level/3),6,10);
    const cellsGrid=[];
    for(let r=0;r<rows;r++){
      const row=[];
      for(let c=0;c<cols;c++)row.push({col:c,row:r,connections:{N:false,S:false,E:false,W:false},visited:false,active:false,dist:Infinity,isStart:false,isGoal:false,enemyBudget:[],distFactor:0,genVisited:false,hasPowerup:false,isAmbushTrap:false,ambushBudget:[],ambushTriggered:false});
      cellsGrid.push(row);
    }
    const startR=Math.floor(rows/2),startC=0;
    const stack=[cellsGrid[startR][startC]];
    cellsGrid[startR][startC].genVisited=true;
    while(stack.length){
      const cur=stack[stack.length-1];
      const options=[];
      DIRS.forEach(([name,dc,dr,opp])=>{
        const nc=cur.col+dc,nr=cur.row+dr;
        if(nc>=0&&nc<cols&&nr>=0&&nr<rows&&!cellsGrid[nr][nc].genVisited)options.push({name,nc,nr,opp});
      });
      if(!options.length){stack.pop();continue;}
      const pick=options[Math.floor(rand()*options.length)];
      const next=cellsGrid[pick.nr][pick.nc];
      cur.connections[pick.name]=true;next.connections[pick.opp]=true;next.genVisited=true;stack.push(next);
    }
    // Braid extra loops so the maze rarely forces a single dead-end path.
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
      const cell=cellsGrid[r][c];
      DIRS.forEach(([name,dc,dr,opp])=>{
        if(cell.connections[name])return;
        const nc=c+dc,nr=r+dr;if(nc<0||nc>=cols||nr<0||nr>=rows)return;
        if(rand()<.15){cell.connections[name]=true;cellsGrid[nr][nc].connections[opp]=true;}
      });
    }
    const startCell=cellsGrid[startR][startC];startCell.isStart=true;startCell.dist=0;
    const queue=[startCell];
    while(queue.length){
      const cur=queue.shift();
      DIRS.forEach(([name,dc,dr])=>{
        if(!cur.connections[name])return;
        const nb=cellsGrid[cur.row+dr][cur.col+dc];
        if(nb.dist===Infinity){nb.dist=cur.dist+1;queue.push(nb);}
      });
    }
    let goalCell=cellsGrid[0][cols-1];
    for(let r=0;r<rows;r++){const cell=cellsGrid[r][cols-1];if(cell.dist>goalCell.dist)goalCell=cell;}
    goalCell.isGoal=true;
    const cellsFlat=cellsGrid.flat();
    const maxDist=Math.max(1,...cellsFlat.map(c=>c.dist===Infinity?0:c.dist));
    assignEnemyBudgets(cellsFlat,level,maxDist);
    assignPowerups(cellsFlat,level);
    assignAmbushTraps(cellsFlat,level);

    const originX=MAZE_MARGIN,originY=MAZE_MARGIN;
    const rectOf=cell=>({x:originX+cell.col*CELL_SIZE,y:originY+cell.row*CELL_SIZE,w:CELL_SIZE,h:CELL_SIZE});
    const wallObstacles=[];
    cellsFlat.forEach(cell=>{
      const rect=rectOf(cell);
      if(!cell.connections.N)wallObstacles.push({x:rect.x-WALL_THICK/2,y:rect.y-WALL_THICK/2,w:CELL_SIZE+WALL_THICK,h:WALL_THICK});
      if(!cell.connections.W)wallObstacles.push({x:rect.x-WALL_THICK/2,y:rect.y-WALL_THICK/2,w:WALL_THICK,h:CELL_SIZE+WALL_THICK});
      if(cell.row===rows-1&&!cell.connections.S)wallObstacles.push({x:rect.x-WALL_THICK/2,y:rect.y+CELL_SIZE-WALL_THICK/2,w:CELL_SIZE+WALL_THICK,h:WALL_THICK});
      if(cell.col===cols-1&&!cell.connections.E&&!cell.isGoal)wallObstacles.push({x:rect.x+CELL_SIZE-WALL_THICK/2,y:rect.y-WALL_THICK/2,w:WALL_THICK,h:CELL_SIZE+WALL_THICK});
    });

    // Corridor + boss gate carved from the goal cell's east side.
    const goalRect=rectOf(goalCell);
    wallObstacles.push({x:goalRect.x+CELL_SIZE-WALL_THICK/2,y:goalRect.y-WALL_THICK/2,w:CORRIDOR_LEN+WALL_THICK,h:WALL_THICK});
    wallObstacles.push({x:goalRect.x+CELL_SIZE-WALL_THICK/2,y:goalRect.y+CELL_SIZE-WALL_THICK/2,w:CORRIDOR_LEN+WALL_THICK,h:WALL_THICK});

    const bossArena={
      x:goalRect.x+CELL_SIZE+CORRIDOR_LEN,
      y:goalRect.y+CELL_SIZE/2-BOSS_ARENA_SIZE.h/2,
      w:BOSS_ARENA_SIZE.w,h:BOSS_ARENA_SIZE.h
    };
    const westTopH=goalRect.y-bossArena.y;
    if(westTopH>0)wallObstacles.push({x:bossArena.x-WALL_THICK/2,y:bossArena.y-WALL_THICK/2,w:WALL_THICK,h:westTopH+WALL_THICK});
    const westBottomY=goalRect.y+CELL_SIZE;
    const westBottomH=(bossArena.y+bossArena.h)-westBottomY;
    if(westBottomH>0)wallObstacles.push({x:bossArena.x-WALL_THICK/2,y:westBottomY-WALL_THICK/2,w:WALL_THICK,h:westBottomH+WALL_THICK});
    wallObstacles.push({x:bossArena.x-WALL_THICK/2,y:bossArena.y-WALL_THICK/2,w:bossArena.w+WALL_THICK,h:WALL_THICK});
    wallObstacles.push({x:bossArena.x-WALL_THICK/2,y:bossArena.y+bossArena.h-WALL_THICK/2,w:bossArena.w+WALL_THICK,h:WALL_THICK});
    wallObstacles.push({x:bossArena.x+bossArena.w-WALL_THICK/2,y:bossArena.y-WALL_THICK/2,w:WALL_THICK,h:bossArena.h+WALL_THICK});

    // Pits (impassable to ground units, but projectiles and flying enemies pass over) —
    // random and fairly common per room.
    const pits=[];
    const pitCells=new Set();
    cellsFlat.forEach(cell=>{
      if(cell.isStart||cell.isGoal)return;
      const rect=rectOf(cell);
      const margin=WALL_THICK+26,innerX=rect.x+margin,innerY=rect.y+margin,innerW=rect.w-margin*2,innerH=rect.h-margin*2;
      if(innerW<=60||innerH<=60)return;
      if(Math.random()<.22){
        const w=Math.min(innerW,160+Math.random()*100),h=Math.min(innerH,130+Math.random()*90);
        const x=innerX+Math.random()*Math.max(1,innerW-w),y=innerY+Math.random()*Math.max(1,innerH-h);
        pits.push({x,y,w,h});
        pitCells.add(cell);
      }
    });

    // Environmental hazards (spike traps / slow patches) cluster into a handful of
    // "trapped zones" spanning several connected rooms, rather than being sprinkled
    // evenly everywhere — so most rooms are clean but a trapped zone is genuinely
    // hard to weave through.
    const hazards=[];
    const hazardEligible=cellsFlat.filter(c=>c!==startCell&&c!==goalCell&&!pitCells.has(c));
    const clusterCount=Math.max(2,Math.round(hazardEligible.length/8));
    const usedForClusters=new Set();
    for(let i=0;i<clusterCount;i++){
      const pool=hazardEligible.filter(c=>!usedForClusters.has(c));
      if(!pool.length)break;
      const seed=pool[Math.floor(Math.random()*pool.length)];
      const clusterSize=3+Math.floor(Math.random()*3);
      const cluster=[seed];usedForClusters.add(seed);
      const frontier=[seed];
      while(cluster.length<clusterSize&&frontier.length){
        const cur=frontier.shift();
        const neighbors=DIRS.filter(([name])=>cur.connections[name]).map(([name,dc,dr])=>cellsGrid[cur.row+dr][cur.col+dc]);
        for(const n of neighbors){
          if(n===startCell||n===goalCell||usedForClusters.has(n)||pitCells.has(n))continue;
          cluster.push(n);usedForClusters.add(n);frontier.push(n);
          if(cluster.length>=clusterSize)break;
        }
      }
      cluster.forEach(cell=>{
        const rect=rectOf(cell);
        const margin=WALL_THICK+26,innerX=rect.x+margin,innerY=rect.y+margin,innerW=rect.w-margin*2,innerH=rect.h-margin*2;
        if(innerW<=60||innerH<=60)return;
        const count=1+(Math.random()<.6?1:0);
        for(let k=0;k<count;k++){
          const type=Math.random()<.5?'spike':'slow';
          const r=type==='spike'?32:58;
          const x=innerX+r+Math.random()*Math.max(1,innerW-r*2),y=innerY+r+Math.random()*Math.max(1,innerH-r*2);
          hazards.push({type,x,y,r,phase:Math.random()*2.6,hitApplied:false,cell});
        }
      });
    }

    const worldBounds={
      x:Math.min(originX,bossArena.x)-MAZE_MARGIN,
      y:Math.min(originY,bossArena.y)-MAZE_MARGIN
    };
    worldBounds.w=Math.max(originX+cols*CELL_SIZE,bossArena.x+bossArena.w)-worldBounds.x+MAZE_MARGIN;
    worldBounds.h=Math.max(originY+rows*CELL_SIZE,bossArena.y+bossArena.h)-worldBounds.y+MAZE_MARGIN;

    const startRect=rectOf(startCell);
    const startCenter={x:startRect.x+CELL_SIZE/2,y:startRect.y+CELL_SIZE/2};
    const playerStarts=[{x:startCenter.x-70,y:startCenter.y+55},{x:startCenter.x+70,y:startCenter.y+55}];

    // Seals the corridor behind the players once the boss encounter triggers,
    // so the fight can no longer be skipped by simply walking back out.
    const gateSeal={x:bossArena.x-WALL_THICK/2,y:goalRect.y-WALL_THICK/2,w:WALL_THICK,h:CELL_SIZE+WALL_THICK};

    return {
      cols,rows,cellsGrid,cells:cellsFlat,startCell,goalCell,originX,originY,
      wallObstacles,bossArena,worldBounds,playerStarts,maxDist,midDist:Math.max(1,Math.ceil(maxDist/2)),gateSeal,
      pits,hazards
    };
  }

  const ENEMY_TYPE_WEIGHTS={grunt:34,archer:22,brute:16,spearman:14,mage:9,charger:7,healer:4,shaman:8,wraith:10};
  function unlockedEnemyTypes(level){
    const unlocked=['grunt','archer'];
    if(level>=2)unlocked.push('brute');
    if(level>=3)unlocked.push('spearman');
    if(level>=4)unlocked.push('wraith');
    if(level>=5)unlocked.push('mage','charger');
    if(level>=6)unlocked.push('shaman');
    if(level>=8)unlocked.push('healer');
    return unlocked;
  }

  function assignEnemyBudgets(cellsFlat, level, maxDist) {
    const unlocked=unlockedEnemyTypes(level);
    let minibossPlaced=false;
    cellsFlat.forEach(cell=>{
      cell.distFactor=maxDist?cell.dist/maxDist:0;
      if(cell.isStart||cell.isGoal){cell.enemyBudget=[];return;}
      // Spawn rhythm along the path from start: 3 empty rooms, then 2 spawn rooms,
      // repeating — rather than every room having a chance at enemies.
      const cyclePos=(Math.max(1,cell.dist)-1)%5;
      if(cyclePos<3){cell.enemyBudget=[];return;}
      const count=Math.round(2+cell.distFactor*3.4+Math.min(3,level*.16)+Math.random()*1.8);
      const list=[];
      for(let i=0;i<Math.min(7,Math.max(2,count));i++)list.push(weightedChoice(unlocked,ENEMY_TYPE_WEIGHTS));
      if(level>=3&&cell.distFactor>.6&&Math.random()<.4)list.push('elite');
      if(!minibossPlaced&&level>=4&&cell.distFactor>.5&&Math.random()<.1){
        list[0]='miniboss';minibossPlaced=true;
      }
      cell.enemyBudget=list;
    });
  }

  function assignAmbushTraps(cellsFlat, level) {
    const unlocked=unlockedEnemyTypes(level);
    cellsFlat.forEach(cell=>{
      if(cell.isStart||cell.isGoal){cell.isAmbushTrap=false;cell.ambushBudget=[];return;}
      cell.isAmbushTrap=Math.random()<Math.min(.42,.26+level*.014);
      if(!cell.isAmbushTrap){cell.ambushBudget=[];return;}
      const count=Math.min(8,4+Math.floor(Math.random()*3)+Math.min(2,Math.floor(level/6)));
      cell.ambushBudget=Array.from({length:count},()=>weightedChoice(unlocked,ENEMY_TYPE_WEIGHTS));
      cell.enemyBudget=[];
      cell.ambushTriggered=false;
    });
  }

  function assignPowerups(cellsFlat, level) {
    // A fixed-ish target count per level, independent of maze size — the old flat
    // 28%-per-cell roll produced dozens of power-ups once mazes grew large, which
    // badly outpaced the level-clear upgrade screen and made runs trivial.
    const eligible=cellsFlat.filter(c=>!c.isStart);
    eligible.forEach(c=>{c.hasPowerup=false;});
    const targetCount=Math.min(5,2+Math.floor(level/5));
    sample(eligible,Math.min(targetCount,eligible.length)).forEach(c=>{c.hasPowerup=true;});
  }

  function cellRectFor(cell){return {x:state.maze.originX+cell.col*CELL_SIZE,y:state.maze.originY+cell.row*CELL_SIZE,w:CELL_SIZE,h:CELL_SIZE};}

  function cellAt(x,y){
    const m=state.maze;if(!m)return null;
    const col=Math.floor((x-m.originX)/CELL_SIZE),row=Math.floor((y-m.originY)/CELL_SIZE);
    if(col<0||col>=m.cols||row<0||row>=m.rows)return null;
    return m.cellsGrid[row][col];
  }

  function mazeNeighbors(cell){
    const m=state.maze,list=[];
    if(cell.connections.N)list.push(m.cellsGrid[cell.row-1][cell.col]);
    if(cell.connections.S)list.push(m.cellsGrid[cell.row+1][cell.col]);
    if(cell.connections.E)list.push(m.cellsGrid[cell.row][cell.col+1]);
    if(cell.connections.W)list.push(m.cellsGrid[cell.row][cell.col-1]);
    return list;
  }

  function findCellPath(fromCell,toCell){
    if(fromCell===toCell)return[fromCell];
    const visited=new Set([fromCell]),queue=[[fromCell]];
    while(queue.length){
      const path=queue.shift(),cur=path[path.length-1];
      for(const n of mazeNeighbors(cur)){
        if(visited.has(n))continue;
        if(n===toCell)return[...path,n];
        visited.add(n);queue.push([...path,n]);
      }
    }
    return null;
  }

  function pathDirectionTowards(e,target){
    const direct=norm({x:target.x-e.x,y:target.y-e.y});
    const fromCell=cellAt(e.x,e.y),toCell=cellAt(target.x,target.y);
    if(!fromCell||!toCell||fromCell===toCell)return direct;
    if(!e.pathCache||e.pathCache.from!==fromCell||e.pathCache.to!==toCell){
      e.pathCache={from:fromCell,to:toCell,path:findCellPath(fromCell,toCell)};
    }
    const path=e.pathCache.path;
    if(!path||path.length<2)return direct;
    const next=cellRectFor(path[1]);
    return norm({x:next.x+next.w/2-e.x,y:next.y+next.h/2-e.y});
  }

  // --- Exploration & spawning ------------------------------------------------

  function updateExploration(){
    state.players.forEach(p=>{
      const cell=cellAt(p.x,p.y);
      if(cell&&!cell.visited)markCellVisited(cell);
    });
  }

  function markCellVisited(cell){
    cell.visited=true;cell.active=true;
    mazeNeighbors(cell).forEach(n=>{if(!n.visited&&!n.active)activateCell(n);});
    if(cell.isGoal&&!state.goalAnnounced){
      state.goalAnnounced=true;
      showToast('Gerbang Boss ditemukan! Bereskan musuh lalu masuki gerbang.');
    }
    if(cell.isAmbushTrap&&!cell.ambushTriggered){
      cell.ambushTriggered=true;
      triggerAmbush(cell);
    }
  }

  function scheduleTask(delay,fn){state.delayedTasks.push({time:delay,fn});}
  function updateDelayedTasks(dt){
    if(!state.delayedTasks.length)return;
    state.delayedTasks.forEach(t=>t.time-=dt);
    state.delayedTasks.filter(t=>t.time<=0).forEach(t=>t.fn());
    state.delayedTasks=state.delayedTasks.filter(t=>t.time>0);
  }

  function triggerAmbush(cell){
    const budget=cell.ambushBudget;if(!budget||!budget.length)return;
    const alive=state.players.filter(p=>!p.downed);if(!alive.length)return;
    showToast('Jebakan! Musuh mengepung dari segala arah!');
    window.GameAudio.play('enemyChargeWarning',.3);
    alive.forEach(p=>{p.ambushWarningTimer=1.1;});
    scheduleTask(1.1,()=>{
      if(!state.running||state.paused)return;
      budget.forEach((type,i)=>{
        const anchor=alive[i%alive.length];
        const angle=(i/budget.length)*TAU+Math.random()*.4;
        const d=110+Math.random()*45;
        const pos=findValidPosition(anchor.x+Math.cos(angle)*d,anchor.y+Math.sin(angle)*d,20,[...state.players,...state.enemies]);
        spawnEnemy(type,pos,.7);
      });
      window.GameAudio.play('bossSummon',.34);
    });
  }

  function updateRandomAmbush(dt){
    if(state.phase!=='explore')return;
    state.ambushTimer-=dt;
    if(state.ambushTimer>0)return;
    state.ambushTimer=13+Math.random()*9;
    const refP=state.players[0];if(!refP)return;
    const candidates=state.maze.cells.filter(c=>c.visited&&!c.isStart&&!c.isGoal&&!c.isAmbushTrap);
    if(!candidates.length)return;
    candidates.sort((a,b)=>{
      const ra=cellRectFor(a),rb=cellRectFor(b);
      const da=dist({x:ra.x+CELL_SIZE/2,y:ra.y+CELL_SIZE/2},refP),db=dist({x:rb.x+CELL_SIZE/2,y:rb.y+CELL_SIZE/2},refP);
      return db-da;
    });
    const pick=candidates[Math.floor(Math.random()*Math.min(3,candidates.length))];
    const rect=cellRectFor(pick);
    const center={x:rect.x+rect.w/2,y:rect.y+rect.h/2};
    const unlocked=unlockedEnemyTypes(state.level);
    const count=2+Math.floor(Math.random()*2)+Math.min(2,Math.floor(state.level/5));
    const types=Array.from({length:count},()=>weightedChoice(unlocked,ENEMY_TYPE_WEIGHTS));
    showToast('Terdengar suara langkah dari arah belakang...');
    window.GameAudio.play('enemyWarn',.28);
    state.effects.push({type:'ambushWarning',x:center.x,y:center.y,t:1.4,max:1.4,color:'#ffb454'});
    scheduleTask(1.4,()=>{
      if(!state.running||state.paused)return;
      types.forEach(type=>{
        const pos=findValidPosition(center.x+(Math.random()-.5)*160,center.y+(Math.random()-.5)*160,20,[...state.players,...state.enemies]);
        spawnEnemy(type,pos,.6);
      });
    });
  }

  function activateCell(cell){
    if(cell.active)return;cell.active=true;
    const rect=cellRectFor(cell);
    const center={x:rect.x+rect.w/2,y:rect.y+rect.h/2};
    cell.enemyBudget.forEach(type=>{
      const pos=findValidPosition(center.x+(Math.random()-.5)*rect.w*.5,center.y+(Math.random()-.5)*rect.h*.5,20,[...state.players,...state.enemies],type!=='wraith');
      spawnEnemy(type,pos,cell.distFactor);
    });
    if(cell.hasPowerup){
      const pos=findValidPosition(center.x,center.y,16,[...state.players,...state.enemies,...state.pickups]);
      state.pickups.push({type:'power',x:pos.x,y:pos.y,r:15,t:999999,bob:Math.random()*TAU});
    }
  }

  function checkGateCrossing(dt){
    if(state.gateTriggered||!state.maze)return;
    state.gateBlockedCooldown=Math.max(0,state.gateBlockedCooldown-dt);
    const arena=state.maze.bossArena;
    const crossing=state.players.filter(p=>p.x>=arena.x-10);
    if(!crossing.length)return;
    const enemiesNearby=state.enemies.some(e=>!e.dead&&state.players.some(p=>dist(p,e)<520));
    if(enemiesNearby){
      crossing.forEach(p=>{p.x=Math.min(p.x,arena.x-14);});
      if(state.gateBlockedCooldown<=0){
        state.gateBlockedCooldown=2.2;
        showToast('Bereskan musuh di sekitar sebelum memasuki gerbang!');
        window.GameAudio.play('shieldBreak',.2);
      }
    }else triggerBossEncounter();
  }

  function triggerBossEncounter(){
    state.gateTriggered=true;state.phase='warning';state.phaseTimer=3.4;
    const arena=state.maze.bossArena;
    const entry={x:arena.x+110,y:arena.y+arena.h/2};
    state.players[0].x=entry.x;state.players[0].y=entry.y-60;
    state.players[1].x=entry.x;state.players[1].y=entry.y+60;
    state.obstacles.push({...state.maze.gateSeal});
    state.camera.x=arena.x+arena.w/2;state.camera.y=arena.y+arena.h/2;
    state.spawnQueue=[{delay:2.7,type:'boss',point:{x:arena.x+arena.w*.62,y:arena.y+arena.h/2},distFactor:1}];
    if(state.level>=10){
      state.spawnQueue.push({delay:5.2,type:'grunt',point:randomPointInRect(arena,90),distFactor:1});
      state.spawnQueue.push({delay:5.6,type:'archer',point:randomPointInRect(arena,90),distFactor:1});
    }
    dom.objective.textContent='Boss mendekat...';window.GameAudio.play('waveWarning',.3);
    window.GameAudio.stopMusic();window.GameAudio.play('bossIntro',.5);
    showToast('Gerbang menutup di belakang kalian — bersiap menghadapi penjaga dungeon!');
  }

  function randomPointInRect(rect,margin=60){
    return {x:rect.x+margin+Math.random()*Math.max(1,rect.w-margin*2),y:rect.y+margin+Math.random()*Math.max(1,rect.h-margin*2)};
  }

  function weightedChoice(types,weights){
    const total=types.reduce((s,t)=>s+(weights[t]||1),0);let roll=Math.random()*total;
    for(const t of types){roll-=weights[t]||1;if(roll<=0)return t;}return types[0];
  }

  function enemyDamageMultiplier(level) {
    const normalLevelScaling=1+(level-1)*0.075;
    const lateGameScaling=Math.max(0,level-7)*0.025;
    const deepRunScaling=Math.max(0,level-15)*0.015;
    const earlyGameScaling=level===1?0.78:1;
    return state.difficulty*earlyGameScaling*(normalLevelScaling+lateGameScaling+deepRunScaling);
  }

  function progression(level, distFactor=0){
    const early=level===1?.78:1;
    const mod=state.levelModifier||{};
    const averageUpgrades=state.players.length?state.players.reduce((sum,p)=>sum+p.upgrades.length,0)/state.players.length:0;
    const expectedUpgrades=level*1.05;
    const buildPressure=1+Math.max(0,averageUpgrades-expectedUpgrades)*.035;
    const depthScale=1+Math.min(.2,distFactor*.2);
    return {
      hp:state.difficulty*early*(1+(level-1)*.105+Math.max(0,level-8)*.03)*(mod.enemyHp||1)*buildPressure*depthScale,
      damage: enemyDamageMultiplier(level)*depthScale,
      speed:1+Math.min(.38,(level-1)*.015),
      cooldown:Math.max(.66,1-(level-1)*.018)*(mod.enemyCooldown||1),
      projectile:(1+Math.min(.6,(level-1)*.025))*(mod.projectileSpeed||1),
      windup:Math.max(.76,1-(level-1)*.014)/Math.sqrt(state.difficulty)
    };
  }

  function spawnEnemy(type,point,distFactor=1){
    const p=point,scale=progression(state.level,distFactor);
    const configs={
      grunt:{r:18,hp:38,speed:70,damage:8,range:42,cooldown:1.55,windup:.9,color:COLORS.enemy,score:12},
      archer:{r:17,hp:31,speed:55,damage:7,range:340,cooldown:2.2,windup:1.2,projectileSpeed:215,color:'#ff9275',score:16,ranged:true},
      brute:{r:26,hp:82,speed:46,damage:14,range:56,cooldown:2.35,windup:1.25,color:'#cf5d5d',score:24},
      spearman:{r:20,hp:55,speed:62,damage:12,range:96,cooldown:1.95,windup:1.05,color:'#f27a72',score:22},
      mage:{r:19,hp:44,speed:50,damage:8,range:365,cooldown:2.35,windup:1.25,projectileSpeed:205,color:'#d47dff',score:28,ranged:true},
      charger:{r:24,hp:88,speed:58,damage:17,range:470,cooldown:2.8,windup:1.18,color:'#ff775f',score:34,charger:true},
      healer:{r:20,hp:62,speed:48,damage:0,range:300,cooldown:3.2,windup:1.35,color:'#79e6a4',score:38,support:true},
      shaman:{r:19,hp:42,speed:52,damage:6,range:330,cooldown:2.6,windup:1.3,projectileSpeed:190,color:'#a26bff',score:32,ranged:true,debuffType:'slow'},
      wraith:{r:17,hp:36,speed:88,damage:9,range:52,cooldown:1.6,windup:.8,color:'#9be8ff',score:26,flying:true},
      elite:{r:25,hp:145,speed:70,damage:15,range:62,cooldown:1.6,windup:1.0,color:COLORS.elite,score:70,elite:true},
      miniboss:{r:40,hp:340,speed:58,damage:22,range:85,cooldown:2.1,windup:1.15,color:'#ff9f4d',score:200,miniboss:true},
      boss:{r:62,hp:620+state.level*58,speed:44,damage:24,range:98,cooldown:2.45,windup:1.5,projectileSpeed:215,color:state.theme.accent||COLORS.boss,score:550,boss:true}
    };
    const c=configs[type];
    const e={
      uid:enemyUid++,type,x:p.x,y:p.y,r:c.r,hp:c.hp*scale.hp,maxHp:c.hp*scale.hp,speed:c.speed*scale.speed,damage:c.damage*scale.damage,range:c.range,
      cooldown:c.cooldown*scale.cooldown,windup:c.windup*scale.windup,projectileSpeed:(c.projectileSpeed||0)*scale.projectile,attackTimer:1.2+Math.random()*.9,
      state:'entering',stateTimer:.45,facing:{x:0,y:1},color:c.color,score:c.score,ranged:!!c.ranged,elite:!!c.elite,boss:!!c.boss,charger:!!c.charger,support:!!c.support,
      miniboss:!!c.miniboss,flying:!!c.flying,debuffType:c.debuffType||null,
      target:null,telegraph:null,attackAim:null,attackPattern:null,dead:false,deathTimer:0,phase:1,hitFlash:0,contactCooldown:0,
      modifiers:[],armored:0,regen:0,maxShield:0,shield:0,explosive:false,burn:null,poison:null,slowTimer:0,slowAmount:0,pathCache:null
    };
    if(e.boss){Object.assign(e,createBossProfile(state.level));state.pendingBossName=e.bossName;}
    else if(e.miniboss){Object.assign(e,createMiniBossProfile());showToast(`Waspada! ${e.bossName} muncul!`);window.GameAudio.play('bossIntro',.3);}
    else assignEnemyModifiers(e,state.level);
    state.enemies.push(e);window.GameAudio.play('enemySpawn',.18,e.boss?.6:1);state.effects.push({type:'portal',x:e.x,y:e.y,t:.7,max:.7,color:e.color});
    return e;
  }

  function createBossProfile(level){
    const rand=mulberry32(state.seed+level*811),shapes=['golem','horned','crystal','necromancer'];
    const shape=shapes[Math.floor(rand()*shapes.length)];
    const pool=['slam','burst','dash','laser','summon'];
    for(let i=pool.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
    const titles={golem:'Rift Golem',horned:'Abyssal Horn',crystal:'Prismatic Warden',necromancer:'Echo Necromancer'};
    return {bossShape:shape,bossName:`${titles[shape]} · ${state.theme.name}`,attackPool:pool.slice(0,3)};
  }

  function createMiniBossProfile(){
    const names=['Kapten Perampas','Penjaga Bayangan','Algojo Reruntuhan','Penakluk Lorong'];
    return {bossName:names[Math.floor(Math.random()*names.length)],attackPool:['slam','burst']};
  }

  function assignEnemyModifiers(e,level){
    if(level<4||e.support)return;
    const bonus=(state.levelModifier&&state.levelModifier.modifierBonus)||0;
    const chance=Math.min(.72,.1+(level-4)*.045+bonus);
    if(Math.random()>chance)return;
    const available=['fast','armored','regenerating','shielded','explosive','enraged'];
    const count=level>=14&&Math.random()<.28?2:1;
    sample(available,count).forEach(mod=>{
      e.modifiers.push(mod);
      if(mod==='fast')e.speed*=1.22;
      if(mod==='armored'){e.armored=.2;e.maxHp*=1.12;e.hp=e.maxHp;}
      if(mod==='regenerating')e.regen=e.maxHp*.012;
      if(mod==='shielded'){e.maxShield=e.maxHp*.28;e.shield=e.maxShield;}
      if(mod==='explosive')e.explosive=true;
      if(mod==='enraged'){e.damage*=1.18;e.cooldown*=.86;}
    });
  }

  function update(dt) {
    if(!state.running||state.paused)return;
    if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)dom.toast.classList.remove('visible');}
    state.shake=Math.max(0,state.shake-dt*8);
    if(state.phase==='levelIntro'){
      state.phaseTimer-=dt;if(state.phaseTimer<=0){state.phase='explore';dom.objective.textContent='Jelajahi dungeon dan temukan gerbang boss.';}
    }else if(state.phase==='warning'||state.phase==='combat'){
      if(state.phase==='warning')state.phaseTimer-=dt;
      state.spawnQueue.forEach(s=>s.delay-=dt);
      const ready=state.spawnQueue.filter(s=>s.delay<=0);ready.forEach(s=>spawnEnemy(s.type,s.point,s.distFactor));state.spawnQueue=state.spawnQueue.filter(s=>s.delay>0);
      if(state.phase==='warning'&&state.phaseTimer<=0){state.phase='combat';if(state.enemies.some(e=>e.boss))window.DungeonMusic.playBoss(state.level);}
    }
    readKeyboardInput();updatePlayers(dt);updateDelayedShots(dt);updateEnemies(dt);updateProjectiles(dt);updatePickups(dt);updateHazards(dt);updateEffects(dt);resolveSeparation();enforceTether();updateCamera(dt);
    updateDelayedTasks(dt);
    if(state.phase==='explore'){updateExploration();checkGateCrossing(dt);updateRandomAmbush(dt);}
    updateHud();
  }

  function readKeyboardInput(){
    const vectors=[{x:0,y:0},{x:0,y:0}];
    if(input.keys.has('KeyA'))vectors[0].x--;if(input.keys.has('KeyD'))vectors[0].x++;if(input.keys.has('KeyW'))vectors[0].y--;if(input.keys.has('KeyS'))vectors[0].y++;
    if(input.keys.has('ArrowLeft'))vectors[1].x--;if(input.keys.has('ArrowRight'))vectors[1].x++;if(input.keys.has('ArrowUp'))vectors[1].y--;if(input.keys.has('ArrowDown'))vectors[1].y++;
    vectors.forEach((v,i)=>{if(!input.sticks[i].active&&(v.x||v.y))input.sticks[i].vector=norm(v);else if(!input.sticks[i].active)input.sticks[i].vector={x:0,y:0};});
  }

  function updatePlayers(dt){
    state.players.forEach((p,i)=>{
      p.invuln=Math.max(0,p.invuln-dt);p.shieldDelay=Math.max(0,p.shieldDelay-dt);
      p.retaliationCooldown=Math.max(0,p.retaliationCooldown-dt);p.frostNovaCooldown=Math.max(0,p.frostNovaCooldown-dt);
      p.debuffSlowTimer=Math.max(0,p.debuffSlowTimer-dt);p.weakenTimer=Math.max(0,p.weakenTimer-dt);p.ambushWarningTimer=Math.max(0,p.ambushWarningTimer-dt);
      if(p.regen>0&&!p.downed)p.hp=Math.min(p.maxHp,p.hp+p.regen*dt);
      const partner=state.players[1-i];const close=partner&&!partner.downed&&dist(p,partner)<280;
      if(!p.downed&&p.maxShield>0&&p.shieldDelay<=0)p.shield=Math.min(p.maxShield,p.shield+(p.shieldRegen+(close?p.closeShieldRegen:0))*dt);
      if(p.downed){updateRevive(p,dt);return;}
      const v=input.sticks[i].vector,mag=Math.hypot(v.x,v.y);p.moving=mag>.14;
      if(p.moving){
        p.facing=norm(v);if(p.attackState==='windup'){p.attackState='idle';p.target=null;}
        if(p.attackState!=='active'){
          const separation=partner?dist(p,partner):0,away=partner?norm({x:p.x-partner.x,y:p.y-partner.y}):{x:0,y:0};
          const movingAway=partner&&v.x*away.x+v.y*away.y>0;let tetherFactor=1;
          if(movingAway&&separation>TETHER.soft)tetherFactor=clamp(1-(separation-TETHER.soft)/(TETHER.max-TETHER.soft),0,1);
          const slowMul=p.debuffSlowTimer>0?1-p.debuffSlowAmount:1;
          const speed=p.speed*(1+p.adrenalineStacks*.05)*slowMul*(p.attackState==='recovery'?.55:1)*tetherFactor;moveCircle(p,v.x*speed*dt,v.y*speed*dt);
          if(p.visual.speedTrail&&Math.random()<.32)state.effects.push({type:'trail',x:p.x,y:p.y,t:.24,max:.24,color:p.color});
        }
      }
      p.attackCooldown=Math.max(0,p.attackCooldown-dt);
      if(p.attackState!=='idle'){
        p.attackTimer-=dt;
        if(p.attackState==='windup'&&p.attackTimer<=0)executePlayerAttack(p);
        else if(p.attackState==='active'&&p.attackTimer<=0){p.attackState='recovery';p.attackTimer=.12;}
        else if(p.attackState==='recovery'&&p.attackTimer<=0){p.attackState='idle';p.target=null;}
      }
      if(!p.moving&&p.attackState==='idle'&&p.attackCooldown<=0){
        let target=findPlayerTarget(p);
        if(target){p.facing=norm({x:target.x-p.x,y:target.y-p.y});}
        else target=findWallAimPoint(p);
        if(target){p.target=target;p.attackState='windup';p.attackTimer=.14;p.attackCooldown=p.attackCycle*(1-Math.min(.4,p.adrenalineStacks*.05));}
      }
      updateOrbitBlade(p,dt);
      updateAura(p,dt);
      updatePulseBlast(p,dt);
      updateArcDischarge(p,dt);
      updateAdrenaline(p,dt);
    });
  }

  function findWallAimPoint(p){
    if(p.ricochet<=0)return null;
    const a=Math.atan2(p.facing.y,p.facing.x);
    const steps=Math.ceil(p.rangedRange/16);
    for(let i=3;i<=steps;i++){
      const t=i/steps,px=p.x+Math.cos(a)*p.rangedRange*t,py=p.y+Math.sin(a)*p.rangedRange*t;
      if(pointInObstacle(px,py,4))return{x:px,y:py,isWall:true};
    }
    return null;
  }

  function updateAura(p,dt){
    if(p.auraDamage<=0||p.downed)return;
    state.enemies.forEach(e=>{if(!e.dead&&dist(p,e)<=p.auraRadius+e.r)rawDamageEnemy(e,p.auraDamage*dt,p,true);});
  }

  function updatePulseBlast(p,dt){
    if(p.pulseBlast<=0||p.downed)return;
    p.pulseTimer-=dt;
    if(p.pulseTimer>0)return;
    p.pulseTimer=Math.max(2.2,4.6-p.pulseBlast*.6);
    const radius=140;
    state.enemies.forEach(e=>{
      if(e.dead||dist(p,e)>radius+e.r)return;
      damageEnemy(e,p.meleeDamage*.6*p.pulseBlast,p);
      const dir=norm({x:e.x-p.x,y:e.y-p.y});
      moveCircle(e,dir.x*70,dir.y*70);
    });
    state.effects.push({type:'shockwave',x:p.x,y:p.y,t:.5,max:.5,color:p.color,range:radius});
    window.GameAudio.play('bossSlam',.25);
  }

  function updateArcDischarge(p,dt){
    if(p.arcDischarge<=0||p.downed)return;
    p.arcTimer-=dt;
    if(p.arcTimer>0)return;
    p.arcTimer=Math.max(1.3,3.2-p.arcDischarge*.6);
    const target=state.enemies.filter(e=>!e.dead&&dist(p,e)<=340).sort((a,b)=>dist(p,a)-dist(p,b))[0];
    if(!target)return;
    damageEnemy(target,8+p.arcDischarge*5,p);
    state.effects.push({type:'lightning',x1:p.x,y1:p.y,x2:target.x,y2:target.y,t:.22,max:.22,color:'#ffe36b'});
    window.GameAudio.play('projectileLightning',.22);
  }

  function updateAdrenaline(p,dt){
    if(p.adrenalineStacks<=0)return;
    p.adrenalineTimer-=dt;
    if(p.adrenalineTimer<=0)p.adrenalineStacks=0;
  }

  function updateOrbitBlade(p,dt){
    if(!p.orbitBlade||p.downed)return;
    p.orbitAngle+=dt*(2.4+p.orbitBlade*.22);p.orbitTimer=Math.max(0,p.orbitTimer-dt);
    if(p.orbitTimer>0)return;
    for(let i=0;i<p.orbitBlade;i++){
      const a=p.orbitAngle+i/Math.max(1,p.orbitBlade)*TAU,orb={x:p.x+Math.cos(a)*58,y:p.y+Math.sin(a)*58};
      const target=state.enemies.find(e=>!e.dead&&dist(orb,e)<e.r+13);
      if(target){damageEnemy(target,p.meleeDamage*.28,p);p.orbitTimer=.24;break;}
    }
  }

  function updateRevive(downed,dt){
    const partner=state.players.find(p=>p!==downed);if(!partner||partner.downed)return;
    if(dist(downed,partner)<90){
      downed.reviveProgress+=dt;state.effects.push({type:'revive',x:downed.x,y:downed.y,t:.1,max:.1,color:partner.color});
      if(downed.reviveProgress>=2.8){downed.downed=false;downed.hp=downed.maxHp*.4;downed.shield=downed.maxShield*.35;downed.invuln=2;downed.reviveProgress=0;window.GameAudio.play('playerRevive',.4);showToast(`Player ${downed.id} bangkit!`);}
    }else downed.reviveProgress=Math.max(0,downed.reviveProgress-dt*.45);
  }

  function findPlayerTarget(p){
    const candidates=state.enemies.filter(e=>!e.dead&&e.state!=='entering');
    const melee=candidates.filter(e=>inCone(p,e,p.meleeRange+p.r+e.r,p.meleeAngle*p.detectorScale)&&hasLineOfSight(p,e));
    if(melee.length)return melee.sort((a,b)=>dist(p,a)-dist(p,b))[0];
    const ranged=candidates.filter(e=>inCone(p,e,p.rangedRange,p.rangedAngle*p.detectorScale)&&hasLineOfSight(p,e));
    return ranged.sort((a,b)=>dist(p,a)-dist(p,b))[0]||null;
  }

  function playerDamageMultiplier(p){
    const partner=state.players.find(x=>x!==p),close=partner&&!partner.downed&&dist(p,partner)<280;
    return 1+(close?p.closeDamageBonus+((state.levelModifier&&state.levelModifier.closeDamage)||0):0);
  }

  function executePlayerAttack(p){
    const target=p.target;if(!target||target.dead){p.attackState='recovery';p.attackTimer=.08;return;}
    const isWallShot=target.isWall===true;
    const melee=!isWallShot&&dist(p,target)<=p.meleeRange+p.r+target.r;p.attackState='active';p.attackTimer=.08;
    if(melee){
      window.GameAudio.play('meleeSwing',.24,p.id===1?1.03:.96);
      const facingAngle=Math.atan2(p.facing.y,p.facing.x);
      const frontHit=state.enemies.filter(e=>!e.dead&&dist(p,e)<=p.meleeRange+p.r+e.r&&(p.whirlwind||angleToFacing(p,e)<=p.meleeAngle*.6));
      const hitUids=new Set();
      frontHit.forEach(e=>{
        hitUids.add(e.uid);
        applyMeleeHit(p,e,rollDamage(p,p.meleeDamage));
        if(p.doubleSlash){
          applyMeleeHit(p,e,rollDamage(p,p.meleeDamage)*.55*Math.min(1.35,p.doubleSlash));
          state.effects.push({type:'slash',x:p.x,y:p.y,angle:facingAngle+.3,t:.14,max:.14,color:'#ffffff',range:p.meleeRange*.82});
        }
      });
      if(p.rearMelee>0&&!p.whirlwind){
        const rearHit=state.enemies.filter(e=>!e.dead&&!hitUids.has(e.uid)&&dist(p,e)<=p.meleeRange+p.r+e.r&&angleToBack(p,e)<=p.meleeAngle*.6);
        rearHit.forEach(e=>{hitUids.add(e.uid);applyMeleeHit(p,e,rollDamage(p,p.meleeDamage)*.6);});
        if(rearHit.length)state.effects.push({type:'slash',x:p.x,y:p.y,angle:facingAngle+Math.PI,t:.16,max:.16,color:hexToRgba('#ffffff',.75),range:p.meleeRange*.85});
      }
      if(p.meleeBounce>0&&frontHit.length){
        let current=frontHit[0];const visited=new Set([current.uid]);let bounceScale=.55;
        for(let i=0;i<p.meleeBounce;i++){
          const next=state.enemies.filter(e=>!e.dead&&!visited.has(e.uid)&&dist(current,e)<170).sort((a,b)=>dist(current,a)-dist(current,b))[0];
          if(!next)break;
          state.effects.push({type:'lightning',x1:current.x,y1:current.y,x2:next.x,y2:next.y,t:.2,max:.2,color:'#e8eaff'});
          applyMeleeHit(p,next,rollDamage(p,p.meleeDamage)*bounceScale);visited.add(next.uid);current=next;bounceScale*=.7;
        }
      }
      if(p.meleeShockwave>0){
        state.enemies.filter(e=>!e.dead&&dist(p,e)<=p.meleeRange*1.75+p.r+e.r&&(p.whirlwind||angleToFacing(p,e)<=p.meleeAngle*.72)).forEach(e=>damageEnemy(e,p.meleeDamage*p.meleeShockwave,p));
        state.effects.push({type:'shockwaveArc',x:p.x,y:p.y,angle:facingAngle,t:.32,max:.32,color:p.color,range:p.meleeRange*1.7});
      }
      if(p.whirlwind)state.effects.push({type:'ringSlash',x:p.x,y:p.y,t:.22,max:.22,color:elementColor(p),range:p.meleeRange});
      else state.effects.push({type:'slash',x:p.x,y:p.y,angle:facingAngle,t:.18,max:.18,color:elementColor(p),range:p.meleeRange});
    }else{
      const elementalSound={fire:'projectileFire',ice:'projectileIce',poison:'projectilePoison',lightning:'projectileLightning'}[p.projectileStyle]||'rangedShot';
      window.GameAudio.play(elementalSound,.2,p.id===1?1.08:.94);
      const facingAngle=Math.atan2(p.facing.y,p.facing.x);
      const spread=.13,count=p.multishot,damageScale=multishotDamageScale(count);
      for(let i=0;i<count;i++)fireProjectile(p,facingAngle+(i-(count-1)/2)*spread,damageScale);
      if(p.sideShots>0){
        for(let s=0;s<p.sideShots;s++){fireProjectile(p,facingAngle+Math.PI/2,.45);fireProjectile(p,facingAngle-Math.PI/2,.45);}
      }
      if(p.rearShots>0){
        for(let s=0;s<p.rearShots;s++)fireProjectile(p,facingAngle+Math.PI,.4);
      }
      if(p.volleyCount>0){
        for(let v=1;v<=p.volleyCount;v++)state.delayedShots.push({time:v*.14,p,angle:facingAngle,count,damageScale:damageScale*.8});
      }
    }
  }

  function fireProjectile(p,angle,damageScale){
    state.projectiles.push({
      x:p.x+Math.cos(angle)*28,y:p.y+Math.sin(angle)*28,vx:Math.cos(angle)*p.projectileSpeed,vy:Math.sin(angle)*p.projectileSpeed,
      r:6*p.projectileScale,damage:rollDamage(p,p.rangedDamage)*damageScale,life:1.35,pierce:p.pierce,owner:p,color:elementColor(p),style:p.projectileStyle,
      homing:p.homing,ricochet:p.ricochet,explosiveRadius:p.explosiveRadius,burnPower:p.burnPower,slowPower:p.slowPower,poisonPower:p.poisonPower,chainCount:p.chainCount,hit:new Set()
    });
  }

  function updateDelayedShots(dt){
    if(!state.delayedShots.length)return;
    state.delayedShots.forEach(d=>d.time-=dt);
    state.delayedShots.filter(d=>d.time<=0).forEach(d=>{
      for(let i=0;i<d.count;i++)fireProjectile(d.p,d.angle+(i-(d.count-1)/2)*.13,d.damageScale);
    });
    state.delayedShots=state.delayedShots.filter(d=>d.time>0);
  }

  function multishotDamageScale(count){return [1,.72,.56,.46,.39][Math.min(5,count)-1]||.36;}
  function rollDamage(p,base){const crit=Math.random()<p.critChance;p.lastCrit=crit;const amount=crit?base*1.8:base;return amount*playerDamageMultiplier(p);}
  function elementColor(p){if(p.projectileStyle==='fire')return'#ff9a45';if(p.projectileStyle==='ice')return'#8eeeff';if(p.projectileStyle==='poison')return'#82e86d';if(p.projectileStyle==='lightning')return'#ffe36b';if(p.projectileStyle==='explosive')return'#ff6c76';return p.color;}

  function applyMeleeHit(p,e,dmg){
    const executeMul=(p.executeBonus>0&&e.maxHp>0&&e.hp/e.maxHp<p.executeThreshold)?1+p.executeBonus:1;
    damageEnemy(e,dmg*executeMul,p);applyElementalStatus(e,p);
    if(p.lastCrit)state.effects.push({type:'crit',x:e.x,y:e.y,t:.3,max:.3,color:'#fff35c'});
    if(p.knockback>0&&!e.dead){const dir=norm({x:e.x-p.x,y:e.y-p.y});moveCircle(e,dir.x*p.knockback,dir.y*p.knockback);}
  }
  function angleToBack(p,e){return Math.PI-angleToFacing(p,e);}

  function updateEnemies(dt){
    state.enemies.forEach(e=>{
      if(e.dead)return;
      tickEnemyStatuses(e,dt);if(e.dead)return;
      e.hitFlash=Math.max(0,e.hitFlash-dt);e.contactCooldown=Math.max(0,e.contactCooldown-dt);
      if(e.regen>0)e.hp=Math.min(e.maxHp,e.hp+e.regen*dt);
      if(e.state==='entering'){
        e.stateTimer-=dt;if(e.stateTimer<=0)e.state='chase';return;
      }
      e.attackTimer-=dt;
      if(e.state==='windup'){e.stateTimer-=dt;if(e.stateTimer<=0)enemyAttack(e);return;}
      if(e.state==='recovery'){e.stateTimer-=dt;if(e.stateTimer<=0)e.state='chase';return;}
      const targets=state.players.filter(p=>!p.downed);if(!targets.length)return;
      e.target=targets.sort((a,b)=>dist(e,a)-dist(e,b))[0];
      if(e.support){
        const ally=state.enemies.filter(a=>a!==e&&!a.dead&&a.hp<a.maxHp*.92).sort((a,b)=>dist(e,a)-dist(e,b))[0];
        if(ally&&dist(e,ally)<=e.range&&e.attackTimer<=0){beginEnemyWindup(e,'heal',ally);return;}
      }
      const d=dist(e,e.target),effectiveRange=e.charger?e.range:(e.ranged?e.range:e.range+e.r+e.target.r);
      const hasLOS=hasLineOfSight(e,e.target);
      if(e.attackTimer<=0&&d<=effectiveRange&&hasLOS){
        let pattern=e.ranged?'shot':'melee';
        if(e.type==='mage')pattern='triple';if(e.type==='spearman')pattern='spear';if(e.charger)pattern='charge';
        if(e.boss||e.miniboss)pattern=e.attackPool[Math.floor(Math.random()*e.attackPool.length)];
        beginEnemyWindup(e,pattern,e.target);
      }else if(!hasLOS){
        // Can't see the target (a wall is in the way) — path toward it through the
        // maze's open connections until sight is regained, rather than just pushing
        // straight at it and getting stuck sliding along the wall.
        const v=pathDirectionTowards(e,e.target);e.facing=v;const slow=e.slowTimer>0?1-e.slowAmount:1;moveCircle(e,v.x*e.speed*slow*dt,v.y*e.speed*slow*dt);
      }else if(d>effectiveRange*(e.charger?.45:.82)){
        const v=norm({x:e.target.x-e.x,y:e.target.y-e.y});e.facing=v;const slow=e.slowTimer>0?1-e.slowAmount:1;moveCircle(e,v.x*e.speed*slow*dt,v.y*e.speed*slow*dt);
      }
      if(e.boss||e.miniboss){const ratio=e.hp/e.maxHp;e.phase=ratio<.25?3:ratio<.55?2:1;}
    });
    state.enemies=state.enemies.filter(e=>!e.dead||e.deathTimer>0);state.enemies.forEach(e=>{if(e.dead)e.deathTimer-=dt;});
  }

  function beginEnemyWindup(e,pattern,target){
    e.state='windup';e.stateTimer=Math.max(e.boss?.78:.55,e.windup);e.facing=norm({x:target.x-e.x,y:target.y-e.y});e.attackAim={...e.facing};e.telegraph={x:target.x,y:target.y};e.attackPattern=pattern;e.target=target;
    const warningSound=e.boss&&pattern==='dash'?'bossDashWarning':e.boss&&pattern==='laser'?'bossLaserWarning':pattern==='charge'?'enemyChargeWarning':'enemyWarn';
    window.GameAudio.play(warningSound,.18,e.boss?.65:1);
  }

  function tickEnemyStatuses(e,dt){
    if(e.burn&&e.burn.time>0){
      e.burn.time-=dt;rawDamageEnemy(e,e.burn.dps*dt,e.burn.source,true);
      if(Math.random()<dt*5)state.effects.push({type:'trail',x:e.x+(Math.random()-.5)*e.r,y:e.y-e.r*.4+(Math.random()-.5)*6,t:.32,max:.32,color:'#ff9a45',size:5});
    }
    if(e.poison&&e.poison.time>0){
      e.poison.time-=dt;rawDamageEnemy(e,e.poison.dps*dt,e.poison.source,true);
      if(Math.random()<dt*4)state.effects.push({type:'trail',x:e.x+(Math.random()-.5)*e.r,y:e.y+(Math.random()-.5)*e.r,t:.4,max:.4,color:'#82e86d',size:4});
    }
    e.slowTimer=Math.max(0,e.slowTimer-dt);
  }

  function enemyAttack(e){
    if(!e.target||e.target.downed){e.state='recovery';e.stateTimer=.3;return;}
    const phaseRate=e.phase===3?.68:e.phase===2?.8:1;e.attackTimer=e.cooldown*phaseRate;e.state='recovery';e.stateTimer=e.boss?.5:.3;
    if(e.boss||e.miniboss){bossAttack(e);return;}
    if(e.attackPattern==='heal'){
      window.GameAudio.play('enemyHeal',.2);
      const ally=e.target;if(ally&&!ally.dead){ally.hp=Math.min(ally.maxHp,ally.hp+ally.maxHp*.24);ally.shield=Math.min(ally.maxShield,ally.shield+ally.maxHp*.12);state.effects.push({type:'healBurst',x:ally.x,y:ally.y,t:.5,max:.5,color:'#78efa4'});}return;
    }
    if(e.attackPattern==='charge'){
      window.GameAudio.play('enemyCharge',.24);
      const aim=e.attackAim||e.facing,start={x:e.x,y:e.y},distance=310;
      for(let step=0;step<18;step++)moveCircle(e,aim.x*distance/18,aim.y*distance/18);
      state.effects.push({type:'dash',x1:start.x,y1:start.y,x2:e.x,y2:e.y,t:.3,max:.3,color:e.color});
      state.players.forEach(p=>{if(!p.downed&&distancePointToSegment(p,start,e)<p.r+e.r*.7)damagePlayer(p,e.damage,e);});return;
    }
    if(e.ranged){
      const aim=e.attackAim||norm({x:e.target.x-e.x,y:e.target.y-e.y});
      const shots=e.attackPattern==='triple'?3:1;
      const homingAmt=e.debuffType?.16:(e.type==='mage'&&state.level>=7?.1:0);
      const projColor=e.debuffType==='slow'?'#8eeeff':e.debuffType==='weaken'?'#c9a2ff':e.color;
      for(let i=0;i<shots;i++){
        const off=(i-(shots-1)/2)*.16,a=Math.atan2(aim.y,aim.x)+off;
        state.enemyProjectiles.push({x:e.x,y:e.y,vx:Math.cos(a)*e.projectileSpeed,vy:Math.sin(a)*e.projectileSpeed,r:7,damage:e.damage*(shots>1?.72:1),life:3.5,color:projColor,owner:e,homing:homingAmt,debuff:e.debuffType||null});
      }
      return;
    }
    const reach=e.attackPattern==='spear'?e.range+34:e.range;
    state.effects.push({type:'enemySlash',x:e.x,y:e.y,angle:Math.atan2(e.facing.y,e.facing.x),t:.22,max:.22,color:e.color,range:reach});
    if(dist(e,e.target)<=reach+e.r+e.target.r+10&&angleToFacing(e,e.target)<deg(e.attackPattern==='spear'?38:70))damagePlayer(e.target,e.damage,e);
  }

  function bossAttack(e){
    if(e.attackPattern==='slam'){
      window.GameAudio.play('bossSlam',.5);state.shake=1;state.effects.push({type:'shockwave',x:e.x,y:e.y,t:.7,max:.7,color:e.color,range:205});
      state.players.forEach(p=>{if(!p.downed&&dist(e,p)<205+p.r)damagePlayer(p,e.damage,e);});
    }else if(e.attackPattern==='burst'){
      const count=12+e.phase*4;
      const cursed=e.boss&&e.phase>=2&&Math.random()<.4;
      for(let i=0;i<count;i++){const a=i/count*TAU;state.enemyProjectiles.push({x:e.x,y:e.y,vx:Math.cos(a)*e.projectileSpeed,vy:Math.sin(a)*e.projectileSpeed,r:8,damage:e.damage*.5,life:4,color:cursed?'#c9a2ff':e.color,owner:e,homing:e.phase>=3?.07:0,debuff:cursed?'weaken':null});}
    }else if(e.attackPattern==='dash'){
      window.GameAudio.play('bossDash',.42);
      const start={x:e.x,y:e.y},aim=e.attackAim||e.facing,distance=390;
      for(let step=0;step<22;step++)moveCircle(e,aim.x*distance/22,aim.y*distance/22);
      state.effects.push({type:'dash',x1:start.x,y1:start.y,x2:e.x,y2:e.y,t:.42,max:.42,color:e.color});state.shake=.8;
      state.players.forEach(p=>{if(!p.downed&&distancePointToSegment(p,start,e)<p.r+45)damagePlayer(p,e.damage*1.05,e);});
    }else if(e.attackPattern==='laser'){
      window.GameAudio.play('bossLaser',.42);
      const end={x:e.x+(e.attackAim?.x||e.facing.x)*680,y:e.y+(e.attackAim?.y||e.facing.y)*680};
      state.effects.push({type:'laser',x1:e.x,y1:e.y,x2:end.x,y2:end.y,t:.34,max:.34,color:e.color});state.shake=.6;
      state.players.forEach(p=>{if(!p.downed&&distancePointToSegment(p,e,end)<p.r+28)damagePlayer(p,e.damage*.92,e);});
    }else if(e.attackPattern==='summon'){
      window.GameAudio.play('bossSummon',.36);
      const count=2+e.phase;
      for(let i=0;i<count;i++){
        const a=i/count*TAU,pos=findValidPosition(e.x+Math.cos(a)*130,e.y+Math.sin(a)*130,20,state.enemies);
        spawnEnemy(i%2?'archer':'grunt',pos,1).state='chase';
      }
    }
  }

  function updateProjectiles(dt){
    state.projectiles.forEach(p=>{
      if(p.homing>0){
        const target=state.enemies.filter(e=>!e.dead&&!p.hit.has(e.uid)).sort((a,b)=>dist(p,a)-dist(p,b))[0];
        if(target&&dist(p,target)<260){const speed=Math.hypot(p.vx,p.vy),desired=norm({x:target.x-p.x,y:target.y-p.y});p.vx=lerp(p.vx,desired.x*speed,p.homing);p.vy=lerp(p.vy,desired.y*speed,p.homing);}
      }
      const oldX=p.x,oldY=p.y;p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;
      if(p.owner&&p.owner.boomerang&&!p.returning&&!p.isShard&&p.life<=.15){
        p.returning=true;p.life=1.1;const spd=Math.hypot(p.vx,p.vy)||p.owner.projectileSpeed;const back=norm({x:p.owner.x-p.x,y:p.owner.y-p.y});
        p.vx=back.x*spd;p.vy=back.y*spd;p.hit=new Set();p.color=lighten(p.color,.35);
      }
      if(pointInObstacle(p.x,p.y,p.r)){
        if(p.ricochet>0){p.x=oldX;p.y=oldY;p.vx*=-1;p.vy*=-1;p.ricochet--;window.GameAudio.play('projectileRicochet',.12);state.effects.push({type:'hit',x:p.x,y:p.y,t:.15,max:.15,color:p.color});}
        else p.life=0;
      }
      for(const e of state.enemies){
        if(e.dead||p.hit.has(e.uid)||dist(p,e)>p.r+e.r)continue;
        p.hit.add(e.uid);projectileImpact(p,e);p.pierce--;if(p.pierce<0){p.life=0;break;}
      }
      if(Math.random()<.2)state.effects.push({type:'projectileTrail',x:p.x,y:p.y,t:.16,max:.16,color:p.color,size:p.r});
    });
    state.projectiles=state.projectiles.filter(p=>p.life>0&&insideWorld(p));
    state.enemyProjectiles.forEach(p=>{
      if(p.homing>0){
        const target=state.players.filter(pl=>!pl.downed).sort((a,b)=>dist(p,a)-dist(p,b))[0];
        if(target){const speed=Math.hypot(p.vx,p.vy),desired=norm({x:target.x-p.x,y:target.y-p.y});p.vx=lerp(p.vx,desired.x*speed,p.homing);p.vy=lerp(p.vy,desired.y*speed,p.homing);}
      }
      p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;if(pointInObstacle(p.x,p.y,p.r))p.life=0;
      for(const pl of state.players){
        if(pl.downed||dist(p,pl)>p.r+pl.r)continue;
        damagePlayer(pl,p.damage,p.owner);
        if(p.debuff==='slow'){pl.debuffSlowTimer=2.4;pl.debuffSlowAmount=Math.max(pl.debuffSlowAmount,.45);}
        else if(p.debuff==='weaken'){pl.weakenTimer=4;pl.weakenAmount=Math.max(pl.weakenAmount,.35);}
        p.life=0;break;
      }
    });
    state.enemyProjectiles=state.enemyProjectiles.filter(p=>p.life>0&&insideWorld(p));
  }

  function projectileImpact(p,e){
    damageEnemy(e,p.damage,p.owner);applyElementalStatus(e,p.owner,p);
    if(p.explosiveRadius>0){
      window.GameAudio.play('projectileExplosion',.2);
      state.effects.push({type:'explosion',x:e.x,y:e.y,t:.35,max:.35,color:p.color,range:p.explosiveRadius});
      state.enemies.filter(other=>other!==e&&!other.dead&&dist(e,other)<p.explosiveRadius+other.r).forEach(other=>damageEnemy(other,p.damage*.42,p.owner));
    }
    if(p.chainCount>0){
      let current=e,damage=p.damage*.58;const visited=new Set([e.uid]);
      for(let i=0;i<p.chainCount;i++){
        const next=state.enemies.filter(x=>!x.dead&&!visited.has(x.uid)&&dist(current,x)<190).sort((a,b)=>dist(current,a)-dist(current,b))[0];if(!next)break;
        state.effects.push({type:'lightning',x1:current.x,y1:current.y,x2:next.x,y2:next.y,t:.18,max:.18,color:'#ffe36b'});damageEnemy(next,damage,p.owner);visited.add(next.uid);current=next;damage*=.72;
      }
    }
    if(p.owner.splitShots>0&&!p.hasSplit&&!p.isShard){
      p.hasSplit=true;
      const baseAngle=Math.atan2(p.vy,p.vx);
      [-.5,.5].forEach(off=>{
        const angle=baseAngle+off;
        state.projectiles.push({
          x:e.x,y:e.y,vx:Math.cos(angle)*p.owner.projectileSpeed*.85,vy:Math.sin(angle)*p.owner.projectileSpeed*.85,
          r:4*p.owner.projectileScale,damage:p.damage*.45,life:.85,pierce:0,owner:p.owner,color:'#7ce6ff',style:'arcane',
          homing:0,ricochet:0,explosiveRadius:0,burnPower:0,slowPower:0,poisonPower:0,chainCount:0,hit:new Set([e.uid]),isShard:true
        });
      });
      window.GameAudio.play('projectileRicochet',.14);
    }
  }

  function applyElementalStatus(e,source,payload=source){
    const burn=payload.burnPower||source.burnPower||0,poison=payload.poisonPower||source.poisonPower||0,slow=payload.slowPower||source.slowPower||0;
    if(burn)e.burn={time:3,dps:burn,source};if(poison)e.poison={time:4,dps:poison,source};if(slow){e.slowTimer=2.2;e.slowAmount=Math.max(e.slowAmount,slow);}
  }

  function spikePhaseFor(hz,t){
    const cycle=2.6,dormant=1.4,telegraph=.5;
    const tt=(t+hz.phase)%cycle;
    return tt<dormant?'dormant':tt<dormant+telegraph?'telegraph':'active';
  }

  function updateHazards(dt){
    state.hazardClock+=dt;
    state.hazards.forEach(hz=>{
      if(!hz.cell.active&&!hz.cell.visited)return;
      if(hz.type==='spike'){
        const phase=spikePhaseFor(hz,state.hazardClock);
        if(phase==='active'){
          if(!hz.hitApplied){
            state.players.forEach(p=>{if(!p.downed&&dist(p,hz)<hz.r+p.r){damagePlayer(p,14,null);hz.hitApplied=true;}});
          }
        }else hz.hitApplied=false;
      }else if(hz.type==='slow'){
        state.players.forEach(p=>{if(!p.downed&&dist(p,hz)<hz.r+p.r){p.debuffSlowTimer=.6;p.debuffSlowAmount=Math.max(p.debuffSlowAmount,.45);}});
      }
    });
  }

  function updatePickups(dt){
    state.pickups.forEach(item=>{
      item.t-=dt;item.bob+=dt*3;
      state.players.forEach(pl=>{
        if(pl.downed||pl.magnetRadius<=0)return;
        const d=dist(item,pl);
        if(d<pl.magnetRadius&&d>6){const dir=norm({x:pl.x-item.x,y:pl.y-item.y});item.x+=dir.x*280*dt;item.y+=dir.y*280*dt;}
      });
      for(const p of state.players){
        if(p.downed||item.t<=0||dist(item,p)>item.r+p.r)continue;
        if(item.type==='heal'&&p.hp<p.maxHp){p.hp=Math.min(p.maxHp,p.hp+30);item.t=0;window.GameAudio.play('pickupHeal',.25);showToast(`P${p.id} memperoleh heal`);}
        else if(item.type==='power'){item.t=0;window.GameAudio.play('pickupUpgrade',.28,p.id===1?1.05:.95);openPowerupPickup(state.players.indexOf(p));}
      }
    });
    state.pickups=state.pickups.filter(p=>p.t>0);
  }

  const POWERUP_REROLLS=2;
  function openPowerupPickup(playerIndex){
    state.paused=true;state.activePowerupPlayer=playerIndex;state.powerupRerollsLeft=POWERUP_REROLLS;
    window.DungeonMusic?.playUpgrade?.();
    dom.powerupTitle.textContent=`Player ${playerIndex+1} menemukan Power-Up!`;
    renderPowerupOptions();
    dom.powerup.classList.add('visible');
  }

  function renderPowerupOptions(){
    const player=state.players[state.activePowerupPlayer];if(!player)return;
    const options=sampleUpgrades(player,3);
    dom.powerupOptions.innerHTML='';
    options.forEach(up=>{
      const button=document.createElement('button');button.type='button';button.className='upgrade-card';
      button.innerHTML=`<span class="upgrade-meta"><b>${up.tag}</b></span><strong>${up.name}</strong><span>${up.desc}</span>`;
      button.addEventListener('click',()=>{
        up.apply(player);player.upgrades.push(up.name);
        window.GameAudio.play('pickupUpgrade',.32,state.activePowerupPlayer?1.12:1);
        window.DungeonMusic?.stopUpgradeAndResume?.();
        dom.powerup.classList.remove('visible');state.paused=false;state.activePowerupPlayer=null;
      });
      dom.powerupOptions.appendChild(button);
    });
    dom.powerupReroll.textContent=`Acak Ulang (${state.powerupRerollsLeft} tersisa)`;
    dom.powerupReroll.disabled=state.powerupRerollsLeft<=0;
  }

  function updateEffects(dt){state.effects.forEach(e=>e.t-=dt);state.effects=state.effects.filter(e=>e.t>0);}

  function damageEnemy(e,amount,source){rawDamageEnemy(e,amount,source,false);}
  function rawDamageEnemy(e,amount,source,quiet){
    if(e.dead||amount<=0)return;
    amount*=1-e.armored;
    if(e.shield>0){const absorbed=Math.min(e.shield,amount);e.shield-=absorbed;amount-=absorbed;}
    if(amount>0)e.hp-=amount;
    if(!quiet){e.hitFlash=.08;window.GameAudio.play('enemyHurt',.09,1+Math.random()*.15);state.effects.push({type:'hit',x:e.x,y:e.y,t:.18,max:.18,color:source?.color||'#ffffff'});}
    if(source&&source.lifesteal>0)source.hp=Math.min(source.maxHp,source.hp+amount*source.lifesteal);
    if(e.hp<=0)killEnemy(e,source);
  }

  function killEnemy(e,source){
    if(e.dead)return;e.dead=true;e.deathTimer=.3;state.score+=e.score;state.levelKills++;window.GameAudio.play('enemyDeath',.18,e.boss?.55:1);state.effects.push({type:'burst',x:e.x,y:e.y,t:.42,max:.42,color:e.color});
    if(e.explosive){
      for(let i=0;i<8;i++){const a=i/8*TAU;state.enemyProjectiles.push({x:e.x,y:e.y,vx:Math.cos(a)*190,vy:Math.sin(a)*190,r:6,damage:e.damage*.45,life:2.4,color:'#ffb24f',owner:e});}
    }
    if(Math.random()<.1&&!e.boss)state.pickups.push({type:'heal',x:e.x,y:e.y,r:13,t:12,bob:0});
    if(source&&source.adrenalineGain){source.adrenalineStacks=Math.min(5,source.adrenalineStacks+1);source.adrenalineTimer=4.5;}
    if(e.boss)triggerVictory();
  }

  function damagePlayer(p,amount,source=null){
    if(p.invuln>0||p.downed)return;
    amount*=1-p.damageReduction;if(p.weakenTimer>0)amount*=1+p.weakenAmount;p.shieldDelay=4;
    if(p.shield>0){const before=p.shield;const absorbed=Math.min(p.shield,amount);p.shield-=absorbed;amount-=absorbed;window.GameAudio.play(p.shield<=0&&before>0?'shieldBreak':'shieldHit',.15);state.effects.push({type:'shieldHit',x:p.x,y:p.y,t:.28,max:.28,color:'#bfeeff'});}
    if(amount>0)p.hp-=amount;
    p.invuln=.7;state.shake=.5;window.GameAudio.play('playerHurt',.22,p.id===1?1.05:.93);state.effects.push({type:'hit',x:p.x,y:p.y,t:.2,max:.2,color:'#ffffff'});
    if(source&&p.thorns>0&&!source.dead&&dist(p,source)<p.r+source.r+90){damageEnemy(source,amount*p.thorns,p);state.effects.push({type:'hit',x:source.x,y:source.y,t:.22,max:.22,color:'#ff6270'});}
    if(source&&!source.dead&&p.retaliation>0&&p.retaliationCooldown<=0){p.retaliationCooldown=Math.max(1.2,2.8-p.retaliation*.5);fireRetaliationBolt(p,source);}
    if(p.frostNova>0&&p.frostNovaCooldown<=0){p.frostNovaCooldown=Math.max(2.6,6-p.frostNova*1.2);triggerFrostNova(p);}
    if(p.hp<=0){
      if(p.deathProtection>0){p.deathProtection--;p.hp=p.maxHp*.25;p.shield=p.maxShield*.35;p.invuln=2.2;state.shake=.7;state.effects.push({type:'burst',x:p.x,y:p.y,t:.6,max:.6,color:'#ffe36b'});showToast(`P${p.id}: Emergency Sigil aktif!`);return;}
      p.hp=0;p.downed=true;p.attackState='idle';p.reviveProgress=0;window.GameAudio.play('playerDown',.35);showToast(`Player ${p.id} down — dekati untuk revive`);checkGameOver();
    }
  }

  function fireRetaliationBolt(p,target){
    const angle=Math.atan2(target.y-p.y,target.x-p.x);
    state.projectiles.push({
      x:p.x,y:p.y,vx:Math.cos(angle)*560,vy:Math.sin(angle)*560,r:7,damage:p.rangedDamage*.8+10,life:1.6,pierce:0,owner:p,color:'#c9a2ff',style:'arcane',
      homing:.5,ricochet:0,explosiveRadius:0,burnPower:0,slowPower:0,poisonPower:0,chainCount:0,hit:new Set()
    });
    window.GameAudio.play('projectileFire',.2);
  }

  function triggerFrostNova(p){
    const radius=150+p.frostNova*20;
    state.enemies.forEach(e=>{
      if(e.dead||dist(p,e)>radius+e.r)return;
      e.slowTimer=2.4;e.slowAmount=Math.max(e.slowAmount,.32+p.frostNova*.08);
    });
    state.effects.push({type:'shockwave',x:p.x,y:p.y,t:.6,max:.6,color:'#8eeeff',range:radius});
    window.GameAudio.play('projectileIce',.28);
  }

  function checkGameOver(){
    if(state.players.every(p=>p.downed)){state.paused=true;window.GameAudio.stopMusic();window.GameAudio.play('gameOver',.45);dom.finalScore.textContent=`Level ${state.level} · Musuh dikalahkan ${state.levelKills} · Score ${state.score}`;dom.gameOver.classList.add('visible');}
  }

  function triggerVictory(){
    state.phase='victory';state.paused=true;
    state.enemies.forEach(en=>{if(!en.boss)en.dead=true;});
    window.GameAudio.stopMusic();window.GameAudio.play('levelComplete',.4);
    window.DungeonMusic?.playUpgrade?.();
    const levelBonus=100*state.level;state.score+=levelBonus;
    dom.victoryTitle.textContent=`${state.pendingBossName||'Boss Dungeon'} Dikalahkan!`;
    dom.victoryDetail.textContent=`${state.biome} · Level ${state.level} berhasil ditaklukkan.`;
    dom.victoryStats.textContent=`Musuh dikalahkan: ${state.levelKills} · Bonus skor +${levelBonus} · Total skor ${state.score}`;
    dom.victory.classList.add('visible');
  }

  function openUpgradeScreen() {
	  window.DungeonMusic?.playUpgrade?.();
    state.paused=true;state.upgradeSelections=[false,false];
    dom.upgradeEyebrow.textContent='LEVEL CLEAR';
    dom.upgradeTitle.textContent='Pilih Upgrade';
    dom.upgradeDescription.textContent='Kembangkan build masing-masing pemain sebelum memasuki level berikutnya.';
    dom.upgrade.classList.add('visible');dom.upgradeStatus.textContent='Menunggu pilihan P1 dan P2...';renderUpgradeOptions(0,dom.p1Upgrades);renderUpgradeOptions(1,dom.p2Upgrades);
  }

  function renderUpgradeOptions(playerIndex,container){
    container.innerHTML='';const player=state.players[playerIndex],options=sampleUpgrades(player,3);
    options.forEach(up=>{
      const button=document.createElement('button');button.type='button';button.className='upgrade-card';
      button.innerHTML=`<span class="upgrade-meta"><b>${up.tag}</b></span><strong>${up.name}</strong><span>${up.desc}</span>`;
      button.addEventListener('click',()=>{
        if(state.upgradeSelections[playerIndex])return;up.apply(player);player.upgrades.push(up.name);state.upgradeSelections[playerIndex]=true;
        [...container.children].forEach(b=>b.disabled=true);button.classList.add('selected');window.GameAudio.play('pickupUpgrade',.3,playerIndex?1.12:1);
        dom.upgradeStatus.textContent=state.upgradeSelections.every(Boolean)?'Pilihan lengkap. Memasuki level berikutnya...':`P${playerIndex+1} selesai. Menunggu partner...`;
        if(state.upgradeSelections.every(Boolean))setTimeout(()=>{
		  window.DungeonMusic?.stopUpgradeAndResume?.();
          dom.upgrade.classList.remove('visible');
          state.level++;state.difficulty=Math.min(2.4,state.difficulty+.08);startLevel();
        },760);
      });container.appendChild(button);
    });
  }

  function sampleUpgrades(player,count){
    const pool=[...UPGRADE_POOL],out=[];
    while(out.length<count&&pool.length){
      const index=Math.floor(Math.random()*pool.length);
      out.push(pool.splice(index,1)[0]);
    }
    return out;
  }

  function restartLevelAssist(){
    dom.gameOver.classList.remove('visible');state.paused=false;state.difficulty=Math.max(.55,state.difficulty*.86);
    state.players.forEach(p=>Object.assign(p,{hp:p.maxHp,shield:p.maxShield,downed:false,reviveProgress:0,attackState:'idle',attackTimer:0,attackCooldown:0,target:null,invuln:2.5}));startLevel(true);
  }

  function updateHud(){
    const[p1,p2]=state.players;if(!p1||!p2)return;
    setPlayerHud(p1,dom.p1Hp,dom.p1Shield,dom.p1Text,dom.p1State,dom.p1Build);setPlayerHud(p2,dom.p2Hp,dom.p2Shield,dom.p2Text,dom.p2State,dom.p2Build);
    dom.level.textContent=`LEVEL ${state.level}`;
    dom.modifier.textContent=state.levelModifier?`${state.levelModifier.name} · ${state.levelModifier.desc}`:'Baseline Dungeon';
    if(state.phase==='levelIntro')dom.objective.textContent=state.biome;
    else if(state.phase==='explore'&&state.maze){
      const visited=state.maze.cells.filter(c=>c.visited).length,total=state.maze.cells.length,active=state.enemies.filter(e=>!e.dead).length;
      dom.objective.textContent=state.goalAnnounced?`Menuju gerbang boss · ${active} musuh aktif`:`Jelajahi dungeon (${visited}/${total}) · ${active} musuh aktif`;
    }
    else if(state.phase==='warning')dom.objective.textContent='Boss mendekat...';
    else if(state.phase==='combat')dom.objective.textContent=state.tetherWarning?'Jarak partner terlalu jauh — kembali mendekat':`${state.enemies.filter(e=>!e.dead).length} musuh tersisa · Score ${state.score}`;
    dom.tetherWarning.classList.toggle('visible',state.tetherWarning);
  }

  function setPlayerHud(p,hpBar,shieldBar,text,stateEl,build){
    hpBar.style.width=`${Math.max(0,p.hp/p.maxHp*100)}%`;shieldBar.style.width=`${p.maxShield?Math.max(0,p.shield/p.maxShield*100):0}%`;
    text.textContent=`${Math.ceil(p.hp)} / ${p.maxHp}${p.maxShield?` · Shield ${Math.ceil(p.shield)}`:''}`;
    stateEl.textContent=p.downed?`DOWN ${Math.floor(p.reviveProgress/2.8*100)}%`:p.moving?'MOVING':p.attackState==='windup'?'AIM':p.attackState==='active'?'ATTACK':'READY';build.textContent=buildName(p);
  }

  function buildName(p){
    const tags=[];if(p.maxShield)tags.push('Aegis');if(p.multishot>1)tags.push(`${p.multishot} Shot`);if(p.projectileStyle!=='arcane')tags.push(capitalize(p.projectileStyle));if(p.orbitBlade)tags.push('Orbit');if(p.meleeShockwave)tags.push('Quake');
    return tags.length?tags.slice(0,2).join(' · '):(p.upgrades.length?`${p.upgrades.length} upgrade`:'Balanced');
  }

  function render(){
    ctx.clearRect(0,0,W,H);drawBackground();const shakeX=state.shake>0?(Math.random()-.5)*state.shake*10:0,shakeY=state.shake>0?(Math.random()-.5)*state.shake*10:0;
    ctx.save();ctx.translate(W/2+shakeX,H/2+shakeY);ctx.scale(state.camera.zoom,state.camera.zoom);ctx.translate(-state.camera.x,-state.camera.y);
    drawPlayfield();drawTether();drawCoopLink();drawDetectors();drawPickups();drawProjectiles();drawEnemies();drawPlayers();drawEffects();ctx.restore();drawJoysticks();drawBossBar();drawMinimap();drawDownedBeacons();
  }

  function drawDownedBeacons(){
    state.players.filter(p=>p.downed).forEach(p=>{
      const screenX=(p.x-state.camera.x)*state.camera.zoom+W/2,screenY=(p.y-state.camera.y)*state.camera.zoom+H/2;
      const margin=64;
      if(screenX>margin&&screenX<W-margin&&screenY>margin&&screenY<H-margin)return;
      const cx=clamp(screenX,margin,W-margin),cy=clamp(screenY,margin,H-margin);
      const angle=Math.atan2(screenY-H/2,screenX-W/2);
      const pulse=.6+.4*Math.sin(performance.now()/180);
      ctx.save();ctx.translate(cx,cy);ctx.rotate(angle);ctx.globalAlpha=pulse;ctx.fillStyle='#ff5d6c';
      ctx.beginPath();ctx.moveTo(17,0);ctx.lineTo(-9,-11);ctx.lineTo(-9,11);ctx.closePath();ctx.fill();
      ctx.restore();
      ctx.save();ctx.globalAlpha=pulse;ctx.fillStyle='#fff';ctx.font='800 11px system-ui';ctx.textAlign='center';
      ctx.fillText(`P${p.id} BUTUH BANTUAN`,cx,cy+(Math.abs(angle)<Math.PI/2?-22:26));
      ctx.restore();
    });
  }

  function drawBackground(){
    const theme=state.theme||BIOMES[0],g=ctx.createRadialGradient(W/2,H/2,40,W/2,H/2,780);g.addColorStop(0,theme.floor2);g.addColorStop(1,theme.void);ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    ctx.globalAlpha=.1;ctx.fillStyle=theme.accent;for(let i=0;i<76;i++){const x=(i*173+state.seed)%W,y=(i*97+state.seed*3)%H;ctx.fillRect(x,y,2+(i%3===0),2+(i%4===0));}ctx.globalAlpha=1;
  }

  function drawPlayfield(){
    const theme=state.theme||BIOMES[0];
    drawMazeFloors(theme);
    drawBossFloor(theme);
    drawPits(theme);
    drawHazards(theme);
    drawObstacles(theme);
  }

  function drawPits(theme){
    state.pits.forEach(o=>{
      ctx.save();
      ctx.shadowColor='rgba(0,0,0,.6)';ctx.shadowBlur=22;
      roundedRect(o.x,o.y,o.w,o.h,20);
      const g=ctx.createLinearGradient(o.x,o.y,o.x,o.y+o.h);
      g.addColorStop(0,theme.wall);g.addColorStop(.45,theme.void);g.addColorStop(1,darken(theme.void,.5));
      ctx.fillStyle=g;ctx.fill();
      ctx.restore();
      ctx.strokeStyle=hexToRgba(theme.edge,.45);ctx.lineWidth=3;roundedRect(o.x,o.y,o.w,o.h,20);ctx.stroke();
      ctx.save();roundedRect(o.x+5,o.y+5,o.w-10,o.h-10,15);ctx.clip();ctx.globalAlpha=.55;
      drawFloorPattern(theme,o);
      ctx.restore();
    });
  }

  function drawHazards(theme){
    state.hazards.forEach(hz=>{
      if(!hz.cell.active&&!hz.cell.visited)return;
      if(hz.type==='spike'){
        const phase=spikePhaseFor(hz,state.hazardClock);
        ctx.save();ctx.translate(hz.x,hz.y);
        ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.arc(0,0,hz.r,0,TAU);ctx.fill();
        if(phase==='dormant'){
          ctx.fillStyle=darken(theme.wall,.2);for(let i=0;i<5;i++){const a=i/5*TAU;ctx.beginPath();ctx.arc(Math.cos(a)*hz.r*.5,Math.sin(a)*hz.r*.5,4,0,TAU);ctx.fill();}
        }else if(phase==='telegraph'){
          ctx.strokeStyle='rgba(255,90,90,.85)';ctx.lineWidth=3;ctx.setLineDash([6,5]);ctx.beginPath();ctx.arc(0,0,hz.r*.85,0,TAU);ctx.stroke();ctx.setLineDash([]);
        }else{
          ctx.fillStyle=lighten(theme.wall,.35);for(let i=0;i<6;i++){const a=i/6*TAU;ctx.beginPath();ctx.moveTo(Math.cos(a)*hz.r*.15,Math.sin(a)*hz.r*.15);ctx.lineTo(Math.cos(a)*hz.r*.9,Math.sin(a)*hz.r*.9);ctx.lineTo(Math.cos(a+.2)*hz.r*.35,Math.sin(a+.2)*hz.r*.35);ctx.closePath();ctx.fill();}
          ctx.fillStyle=hexToRgba(theme.accent,.3);ctx.beginPath();ctx.arc(0,0,hz.r,0,TAU);ctx.fill();
        }
        ctx.restore();
      }else if(hz.type==='slow'){
        ctx.save();ctx.globalAlpha=.55+.1*Math.sin(state.hazardClock*2+hz.phase);
        const g=ctx.createRadialGradient(hz.x,hz.y,2,hz.x,hz.y,hz.r);g.addColorStop(0,theme.accent);g.addColorStop(1,hexToRgba(theme.accent,0));
        ctx.fillStyle=g;ctx.beginPath();ctx.arc(hz.x,hz.y,hz.r,0,TAU);ctx.fill();
        ctx.strokeStyle=hexToRgba(theme.accent,.55);ctx.lineWidth=2;ctx.beginPath();ctx.arc(hz.x,hz.y,hz.r*.7,0,TAU);ctx.stroke();
        ctx.restore();
      }
    });
  }

  function drawMazeFloors(theme){
    const m=state.maze;if(!m)return;
    m.cells.forEach(cell=>{
      if(!cell.visited&&!cell.active)return;
      const rect=cellRectFor(cell);
      ctx.save();ctx.shadowColor='rgba(0,0,0,.4)';ctx.shadowBlur=22;ctx.fillStyle=theme.floor;roundedRect(rect.x+6,rect.y+6,rect.w-12,rect.h-12,16);ctx.fill();ctx.restore();
      ctx.strokeStyle=hexToRgba(theme.accent,.14);ctx.lineWidth=2;roundedRect(rect.x+6,rect.y+6,rect.w-12,rect.h-12,16);ctx.stroke();
      if(cell.isGoal){
        ctx.save();ctx.translate(rect.x+rect.w/2,rect.y+rect.h/2);const t=performance.now()/500;
        ctx.strokeStyle=theme.accent;ctx.lineWidth=4;ctx.globalAlpha=.65+.3*Math.sin(t);
        drawPolygon(0,0,46,4,t*.4);ctx.stroke();ctx.restore();
      }
    });
  }

  function drawBossFloor(theme){
    const m=state.maze;if(!m||!(m.goalCell.visited||m.goalCell.active))return;
    const rect=m.bossArena;
    ctx.save();ctx.shadowColor='rgba(0,0,0,.55)';ctx.shadowBlur=38;roundedRect(rect.x,rect.y,rect.w,rect.h,30);ctx.fillStyle=theme.floor;ctx.fill();ctx.restore();
    ctx.lineWidth=10;ctx.strokeStyle=theme.edge;roundedRect(rect.x,rect.y,rect.w,rect.h,30);ctx.stroke();
    ctx.save();roundedRect(rect.x+12,rect.y+12,rect.w-24,rect.h-24,22);ctx.clip();drawFloorPattern(theme,rect);ctx.restore();
  }

  function drawFloorPattern(theme,rect){
    ctx.strokeStyle='rgba(255,255,255,.035)';ctx.lineWidth=1;
    for(let x=rect.x;x<rect.x+rect.w;x+=48){ctx.beginPath();ctx.moveTo(x,rect.y);ctx.lineTo(x,rect.y+rect.h);ctx.stroke();}
    for(let y=rect.y;y<rect.y+rect.h;y+=48){ctx.beginPath();ctx.moveTo(rect.x,y);ctx.lineTo(rect.x+rect.w,y);ctx.stroke();}
    ctx.strokeStyle=hexToRgba(theme.accent,.11);ctx.lineWidth=2;
    for(let i=0;i<26;i++){
      const x=rect.x+80+((i*191+state.seed)%Math.floor(Math.max(1,rect.w-160))),y=rect.y+70+((i*127+state.seed*2)%Math.floor(Math.max(1,rect.h-140)));
      ctx.beginPath();if(theme.pattern==='crack'){ctx.moveTo(x-18,y-8);ctx.lineTo(x,y);ctx.lineTo(x-10,y+20);ctx.moveTo(x,y);ctx.lineTo(x+22,y+13);}else{ctx.arc(x,y,8+(i%3)*5,0,TAU);}ctx.stroke();
    }
  }

  function drawObstacles(theme){
    state.obstacles.forEach(o=>{
      ctx.save();ctx.shadowColor='rgba(0,0,0,.45)';ctx.shadowBlur=18;ctx.fillStyle=theme.wall;roundedRect(o.x,o.y,o.w,o.h,10);ctx.fill();ctx.restore();
      ctx.strokeStyle=theme.edge;ctx.globalAlpha=.5;ctx.lineWidth=3;roundedRect(o.x,o.y,o.w,o.h,10);ctx.stroke();ctx.globalAlpha=1;
    });
  }

  function drawTether(){const[p1,p2]=state.players;if(!p1||!p2||!state.tetherWarning)return;ctx.save();ctx.strokeStyle='rgba(255,210,79,.6)';ctx.lineWidth=5;ctx.setLineDash([14,12]);ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.stroke();ctx.restore();}

  function drawCoopLink(){
    const[p1,p2]=state.players;if(!p1||!p2||p1.downed||p2.downed)return;
    const hasBonus=p1.closeDamageBonus>0||p1.closeShieldRegen>0||p2.closeDamageBonus>0||p2.closeShieldRegen>0;
    if(!hasBonus||dist(p1,p2)>=280)return;
    ctx.save();ctx.globalAlpha=.35+.12*Math.sin(performance.now()/240);ctx.strokeStyle='#b998ff';ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.stroke();ctx.restore();
  }

  function drawDetectors(){state.players.forEach(p=>{if(p.downed||p.moving||p.attackState==='active')return;drawCone(p,p.rangedRange,p.rangedAngle*p.detectorScale,hexToRgba(p.color,.055));drawCone(p,p.meleeRange+p.r,p.meleeAngle*p.detectorScale,'rgba(255,255,255,.095)');});}
  function drawCone(p,range,angle,color){const a=Math.atan2(p.facing.y,p.facing.x);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.arc(p.x,p.y,range,a-angle/2,a+angle/2);ctx.closePath();ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='rgba(255,255,255,.065)';ctx.stroke();}

  function drawPlayers(){
    state.players.forEach(p=>{
      ctx.save();ctx.translate(p.x,p.y);if(p.invuln>0&&Math.floor(p.invuln*10)%2===0)ctx.globalAlpha=.45;
      if(p.auraDamage>0){ctx.save();ctx.globalAlpha=.14+.07*Math.sin(performance.now()/260);ctx.strokeStyle='#ffe36b';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,p.auraRadius,0,TAU);ctx.stroke();ctx.restore();}
      if(p.adrenalineStacks>0){ctx.save();ctx.globalAlpha=.18+p.adrenalineStacks*.09;ctx.strokeStyle='#ffb454';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,p.r+7,0,TAU);ctx.stroke();ctx.restore();}
      if(p.visual.speedTrail){ctx.strokeStyle=p.color;ctx.globalAlpha=.25;ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(-p.facing.x*40,-p.facing.y*40);ctx.lineTo(-p.facing.x*13,-p.facing.y*13);ctx.stroke();ctx.globalAlpha=1;}
      if(p.maxShield>0&&p.shield>0){drawPolygon(0,0,p.r+12,6,-Math.PI/2);ctx.fillStyle=hexToRgba('#9fe9ff',.1+.18*p.shield/p.maxShield);ctx.fill();ctx.strokeStyle='#bfefff';ctx.lineWidth=2.5;ctx.stroke();}
      if(p.visual.armor){ctx.fillStyle='#dfe8f5';roundedRect(-p.r-8,-12,12,24,5);ctx.fill();roundedRect(p.r-4,-12,12,24,5);ctx.fill();}
      ctx.fillStyle=p.downed?'#4e5466':p.color;drawPolygon(0,0,p.r,8,Math.PI/8);ctx.fill();ctx.lineWidth=4;ctx.strokeStyle='rgba(255,255,255,.78)';ctx.stroke();
      const weaponLen=p.visual.heavyWeapon?34:27;ctx.fillStyle=elementColor(p);ctx.beginPath();ctx.moveTo(p.facing.x*weaponLen,p.facing.y*weaponLen);ctx.lineTo(-p.facing.y*8-p.facing.x*4,p.facing.x*8-p.facing.y*4);ctx.lineTo(p.facing.y*8-p.facing.x*4,-p.facing.x*8-p.facing.y*4);ctx.closePath();ctx.fill();
      drawElementMarks(p);
      if(p.orbitBlade){for(let i=0;i<p.orbitBlade;i++){const a=p.orbitAngle+i/p.orbitBlade*TAU;ctx.save();ctx.translate(Math.cos(a)*58,Math.sin(a)*58);ctx.rotate(a+Math.PI/2);ctx.fillStyle='#f7f5ff';ctx.beginPath();ctx.moveTo(0,-10);ctx.lineTo(5,8);ctx.lineTo(0,13);ctx.lineTo(-5,8);ctx.closePath();ctx.fill();ctx.restore();}}
      if(p.visual.projectileCrown){for(let i=0;i<3;i++){const a=performance.now()/280+i/3*TAU;ctx.save();ctx.translate(Math.cos(a)*(p.r+15),Math.sin(a)*(p.r+15));ctx.fillStyle=elementColor(p);ctx.beginPath();ctx.arc(0,0,3.4,0,TAU);ctx.fill();ctx.restore();}}
      if(p.downed){
        const pulse=.5+.5*Math.sin(performance.now()/170);
        ctx.save();ctx.globalAlpha=.45+.35*pulse;ctx.strokeStyle='#ff5d6c';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,p.r+18+pulse*7,0,TAU);ctx.stroke();ctx.restore();
        ctx.strokeStyle='#fff';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,p.r+10,-Math.PI/2,-Math.PI/2+TAU*(p.reviveProgress/2.8));ctx.stroke();
        ctx.save();ctx.translate(0,-p.r-26-Math.sin(performance.now()/240)*4);ctx.globalAlpha=.6+.4*pulse;ctx.fillStyle='#ff5d6c';ctx.font='900 22px system-ui';ctx.textAlign='center';ctx.fillText('!',0,0);ctx.restore();
      }
      if(p.ambushWarningTimer>0){
        const shakeX=(Math.random()-.5)*3,shakeY=(Math.random()-.5)*2;
        ctx.save();ctx.translate(shakeX,-p.r-24+shakeY);ctx.globalAlpha=.7+.3*Math.sin(performance.now()/85);
        ctx.fillStyle='#ffcf4d';ctx.font='900 20px system-ui';ctx.textAlign='center';ctx.fillText('!',0,0);
        ctx.restore();
      }
      ctx.fillStyle='#08101d';ctx.font='800 13px system-ui';ctx.textAlign='center';ctx.fillText(`P${p.id}`,0,5);ctx.restore();
    });
  }

  function drawElementMarks(p){
    const marks=[];if(p.visual.fire)marks.push('#ff9a45');if(p.visual.ice)marks.push('#8eeeff');if(p.visual.poison)marks.push('#82e86d');if(p.visual.lightning)marks.push('#ffe36b');
    marks.forEach((color,i)=>{const a=i/Math.max(1,marks.length)*TAU-Math.PI/2;ctx.fillStyle=color;ctx.beginPath();ctx.arc(Math.cos(a)*(p.r+5),Math.sin(a)*(p.r+5),4,0,TAU);ctx.fill();});
  }

  function drawEnemies(){
    state.enemies.forEach(e=>{
      ctx.save();ctx.translate(e.x,e.y);if(e.dead)ctx.globalAlpha=Math.max(0,e.deathTimer/.3);if(e.hitFlash>0)ctx.globalAlpha=.55;
      if(e.state==='windup')drawEnemyTelegraph(e);
      if(e.boss)drawBossBody(e);else if(e.miniboss)drawMiniBossBody(e);else drawEnemyBody(e);
      drawEnemyModifiers(e);ctx.restore();
      if(!e.boss&&!e.dead){
        const bw=e.r*2.2;ctx.fillStyle='rgba(0,0,0,.58)';ctx.fillRect(e.x-bw/2,e.y-e.r-15,bw,6);ctx.fillStyle=e.color;ctx.fillRect(e.x-bw/2,e.y-e.r-15,bw*Math.max(0,e.hp/e.maxHp),6);if(e.maxShield){ctx.fillStyle='#9fe9ff';ctx.fillRect(e.x-bw/2,e.y-e.r-20,bw*Math.max(0,e.shield/e.maxShield),3);}
        if(e.miniboss){ctx.fillStyle='#ffcf94';ctx.font='800 11px system-ui';ctx.textAlign='center';ctx.fillText(e.bossName||'Elite',e.x,e.y-e.r-22);}
      }
    });
  }

  function drawEnemyTelegraph(e){
    const big=e.boss||e.miniboss;
    ctx.fillStyle=big?COLORS.danger:COLORS.warning;ctx.beginPath();ctx.arc(0,0,e.r+(e.boss?72:big?52:34),0,TAU);ctx.fill();ctx.strokeStyle='rgba(255,220,95,.92)';ctx.lineWidth=5;ctx.setLineDash([12,9]);
    if(e.attackPattern==='shot'||e.attackPattern==='triple'||e.attackPattern==='laser'||e.attackPattern==='charge'){
      const length=e.attackPattern==='laser'?680:e.attackPattern==='charge'?390:560;const width=e.attackPattern==='charge'?52:0;
      if(width){ctx.fillStyle='rgba(255,88,102,.18)';ctx.save();ctx.rotate(Math.atan2(e.attackAim.y,e.attackAim.x));ctx.fillRect(0,-width/2,length,width);ctx.restore();}
      else{const angles=e.attackPattern==='triple'?[-.16,0,.16]:[0];angles.forEach(off=>{const a=Math.atan2(e.attackAim.y,e.attackAim.x)+off;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(a)*length,Math.sin(a)*length);ctx.stroke();});}
    }else if(e.attackPattern==='slam'){ctx.beginPath();ctx.arc(0,0,205,0,TAU);ctx.stroke();}
    else if(e.attackPattern==='burst'){ctx.beginPath();ctx.arc(0,0,250,0,TAU);ctx.stroke();for(let i=0;i<12;i++){const a=i/12*TAU;ctx.beginPath();ctx.moveTo(Math.cos(a)*78,Math.sin(a)*78);ctx.lineTo(Math.cos(a)*230,Math.sin(a)*230);ctx.stroke();}}
    else if(e.attackPattern==='summon'){for(let i=0;i<4;i++){const a=i/4*TAU;ctx.beginPath();ctx.arc(Math.cos(a)*130,Math.sin(a)*130,24,0,TAU);ctx.stroke();}}
    else if(e.attackPattern==='heal'&&e.target){ctx.strokeStyle='#79e6a4';ctx.beginPath();ctx.arc(e.target.x-e.x,e.target.y-e.y,e.target.r+18,0,TAU);ctx.stroke();}
    else{const a=Math.atan2(e.facing.y,e.facing.x),angle=e.attackPattern==='spear'?deg(38):deg(75),range=e.range+e.r+35;ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,range,a-angle/2,a+angle/2);ctx.closePath();ctx.stroke();}
    ctx.setLineDash([]);
  }

  function drawEnemyBody(e){
    if(e.flying)ctx.globalAlpha*=.8+.15*Math.sin(performance.now()/180+e.uid);
    ctx.fillStyle=e.color;ctx.strokeStyle=e.elite?'#fff1ba':'rgba(255,255,255,.55)';ctx.lineWidth=e.elite?5:3;
    if(e.type==='archer'){drawPolygon(0,0,e.r,3,Math.atan2(e.facing.y,e.facing.x));}
    else if(e.type==='brute'){roundedRect(-e.r,-e.r,e.r*2,e.r*2,7);}
    else if(e.type==='spearman'){drawPolygon(0,0,e.r,4,Math.PI/4);}
    else if(e.type==='mage'){drawPolygon(0,0,e.r,6,Math.PI/6);}
    else if(e.type==='shaman'){drawPolygon(0,0,e.r,5,-Math.PI/2);}
    else if(e.type==='charger'){drawPolygon(0,0,e.r,5,Math.atan2(e.facing.y,e.facing.x));}
    else if(e.type==='healer'){drawPolygon(0,0,e.r,8,Math.PI/8);}
    else if(e.type==='wraith'){
      const bob=Math.sin(performance.now()/200+e.uid)*4;
      ctx.beginPath();ctx.arc(0,bob,e.r,Math.PI,TAU);ctx.lineTo(e.r,e.r*.7+bob);ctx.lineTo(e.r*.4,e.r*.35+bob);ctx.lineTo(0,e.r*.7+bob);ctx.lineTo(-e.r*.4,e.r*.35+bob);ctx.lineTo(-e.r,e.r*.7+bob);ctx.closePath();
    }
    else if(e.elite){drawStar(0,0,e.r,e.r*.55,6);}
    else{ctx.beginPath();ctx.arc(0,0,e.r,0,TAU);}
    ctx.fill();ctx.stroke();
    if(e.type==='healer'){ctx.strokeStyle='#e8fff0';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-8,0);ctx.lineTo(8,0);ctx.moveTo(0,-8);ctx.lineTo(0,8);ctx.stroke();}
    else if(e.type==='shaman'){ctx.fillStyle='#e8d6ff';ctx.beginPath();ctx.arc(0,-2,5,0,TAU);ctx.fill();}
    else{ctx.fillStyle='#34151a';ctx.beginPath();ctx.arc(-6,-3,3,0,TAU);ctx.arc(6,-3,3,0,TAU);ctx.fill();}
  }

  function drawBossBody(e){
    ctx.fillStyle=e.color;ctx.strokeStyle='#fff1cf';ctx.lineWidth=6;
    if(e.bossShape==='golem'){
      roundedRect(-e.r,-e.r*.78,e.r*2,e.r*1.56,15);ctx.fill();ctx.stroke();ctx.fillStyle=darken(e.color,.45);roundedRect(-e.r-24,-28,30,56,8);ctx.fill();roundedRect(e.r-6,-28,30,56,8);ctx.fill();
    }else if(e.bossShape==='horned'){
      drawPolygon(0,4,e.r,5,-Math.PI/2);ctx.fill();ctx.stroke();ctx.fillStyle=e.color;ctx.beginPath();ctx.moveTo(-30,-48);ctx.lineTo(-58,-92);ctx.lineTo(-8,-58);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(30,-48);ctx.lineTo(58,-92);ctx.lineTo(8,-58);ctx.closePath();ctx.fill();
    }else if(e.bossShape==='crystal'){
      drawPolygon(0,0,e.r,6,Math.PI/6);ctx.fill();ctx.stroke();for(let i=0;i<6;i++){const a=i/6*TAU;ctx.fillStyle=lighten(e.color,.25);ctx.beginPath();ctx.moveTo(Math.cos(a)*e.r*.7,Math.sin(a)*e.r*.7);ctx.lineTo(Math.cos(a)*(e.r+30),Math.sin(a)*(e.r+30));ctx.lineTo(Math.cos(a+.14)*e.r*.72,Math.sin(a+.14)*e.r*.72);ctx.closePath();ctx.fill();}
    }else{
      ctx.beginPath();ctx.moveTo(0,-e.r);ctx.quadraticCurveTo(e.r,-e.r*.45,e.r*.72,e.r*.72);ctx.lineTo(0,e.r+25);ctx.lineTo(-e.r*.72,e.r*.72);ctx.quadraticCurveTo(-e.r,-e.r*.45,0,-e.r);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle=darken(e.color,.62);ctx.beginPath();ctx.arc(0,-12,e.r*.5,Math.PI,TAU);ctx.lineTo(e.r*.5,8);ctx.lineTo(-e.r*.5,8);ctx.closePath();ctx.fill();
    }
    ctx.fillStyle='#f7eaff';ctx.beginPath();ctx.arc(-13,-8,5,0,TAU);ctx.arc(13,-8,5,0,TAU);ctx.fill();
    if(e.attackPool.includes('laser')){ctx.fillStyle='#fff4a8';ctx.beginPath();ctx.arc(0,-30,9,0,TAU);ctx.fill();}
    if(e.attackPool.includes('summon')){ctx.strokeStyle='#d8b5ff';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,e.r+18,0,TAU);ctx.stroke();}
  }

  function drawMiniBossBody(e){
    ctx.fillStyle=e.color;ctx.strokeStyle='#fff1cf';ctx.lineWidth=5;
    drawStar(0,0,e.r,e.r*.68,7);ctx.fill();ctx.stroke();
    ctx.fillStyle=darken(e.color,.4);
    for(let i=0;i<3;i++){const a=-Math.PI/2+(i-1)*.5;ctx.beginPath();ctx.moveTo(Math.cos(a)*e.r*.3,Math.sin(a)*e.r*.3-e.r*.55);ctx.lineTo(Math.cos(a-.12)*e.r*.9,Math.sin(a-.12)*e.r*.9-e.r*.55);ctx.lineTo(Math.cos(a+.12)*e.r*.9,Math.sin(a+.12)*e.r*.9-e.r*.55);ctx.closePath();ctx.fill();}
    ctx.fillStyle='#fff4d6';ctx.beginPath();ctx.arc(-10,-4,4.5,0,TAU);ctx.arc(10,-4,4.5,0,TAU);ctx.fill();
  }

  function drawEnemyModifiers(e){
    if(!e.modifiers.length)return;const colors={fast:'#7ae7ff',armored:'#d7dde7',regenerating:'#72ef9a',shielded:'#9fe9ff',explosive:'#ffb24f',enraged:'#ff6270'};
    e.modifiers.forEach((mod,i)=>{const a=i/e.modifiers.length*TAU-Math.PI/2;ctx.fillStyle=colors[mod];ctx.beginPath();ctx.arc(Math.cos(a)*(e.r+10),Math.sin(a)*(e.r+10),4,0,TAU);ctx.fill();});
    if(e.maxShield&&e.shield>0){ctx.strokeStyle='#9fe9ff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,e.r+7,0,TAU);ctx.stroke();}
  }

  function drawProjectiles(){
    state.projectiles.forEach(p=>{
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(p.vy,p.vx));ctx.shadowColor=p.color;ctx.shadowBlur=12;ctx.fillStyle=p.color;ctx.strokeStyle='#ffffffaa';ctx.lineWidth=1.5;
      if(p.style==='fire'){ctx.beginPath();ctx.moveTo(p.r*1.5,0);ctx.quadraticCurveTo(-p.r*.2,-p.r,p.r*-1.5,0);ctx.quadraticCurveTo(-p.r*.2,p.r,p.r*1.5,0);ctx.fill();}
      else if(p.style==='ice'){ctx.beginPath();ctx.moveTo(p.r*1.7,0);ctx.lineTo(-p.r,-p.r*.7);ctx.lineTo(-p.r*.5,0);ctx.lineTo(-p.r,p.r*.7);ctx.closePath();ctx.fill();ctx.stroke();}
      else if(p.style==='poison'){ctx.beginPath();ctx.arc(0,0,p.r,0,TAU);ctx.fill();ctx.fillStyle='#d8ffd0';ctx.beginPath();ctx.arc(-p.r*.25,-p.r*.25,p.r*.25,0,TAU);ctx.fill();}
      else if(p.style==='lightning'){ctx.beginPath();ctx.moveTo(p.r*1.5,0);ctx.lineTo(0,-p.r*.65);ctx.lineTo(p.r*.2,0);ctx.lineTo(-p.r*1.25,p.r*.4);ctx.lineTo(-p.r*.1,p.r*.05);ctx.closePath();ctx.fill();}
      else if(p.style==='explosive'){drawStar(0,0,p.r*1.25,p.r*.72,6);ctx.fill();ctx.stroke();}
      else{drawPolygon(0,0,p.r,4,Math.PI/4);ctx.fill();ctx.stroke();}
      ctx.restore();
    });
    state.enemyProjectiles.forEach(p=>{ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,TAU);ctx.fill();ctx.strokeStyle='#ffe5cf';ctx.lineWidth=2;ctx.stroke();});
  }

  function drawPickups(){
    state.pickups.forEach(p=>{
      const y=p.y+Math.sin(p.bob)*5;
      if(p.type==='power'){
        ctx.save();ctx.translate(p.x,y);ctx.rotate(performance.now()/450);
        ctx.fillStyle=COLORS.upgrade;drawPolygon(0,0,p.r,6,0);ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();
        ctx.restore();
        ctx.save();ctx.globalAlpha=.3+.25*Math.sin(performance.now()/220);ctx.strokeStyle=COLORS.upgrade;ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x,y,p.r+7,0,TAU);ctx.stroke();ctx.restore();
      }else{
        ctx.fillStyle=COLORS.heal;drawPolygon(p.x,y,p.r,6,Math.PI/6);ctx.fill();ctx.fillStyle='#143d2a';ctx.fillRect(p.x-3,y-8,6,16);ctx.fillRect(p.x-8,y-3,16,6);
      }
    });
  }

  function drawEffects(){
    state.effects.forEach(e=>{const k=1-e.t/e.max;ctx.save();ctx.globalAlpha=Math.max(0,e.t/e.max);ctx.strokeStyle=e.color;ctx.fillStyle=e.color;
      if(e.type==='portal'){ctx.lineWidth=5;ctx.beginPath();ctx.arc(e.x,e.y,12+k*38,0,TAU);ctx.stroke();}
      else if(e.type==='slash'||e.type==='enemySlash'){ctx.lineWidth=10;ctx.beginPath();ctx.arc(e.x,e.y,e.range*.65,e.angle-.7,e.angle+.7);ctx.stroke();}
      else if(e.type==='shockwaveArc'){ctx.lineWidth=7;ctx.beginPath();ctx.arc(e.x,e.y,e.range*k,e.angle-.85,e.angle+.85);ctx.stroke();}
      else if(e.type==='hit'){ctx.lineWidth=4;for(let i=0;i<5;i++){const a=i/5*TAU;ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.lineTo(e.x+Math.cos(a)*(10+k*24),e.y+Math.sin(a)*(10+k*24));ctx.stroke();}}
      else if(e.type==='burst'||e.type==='healBurst'||e.type==='shieldHit'){ctx.lineWidth=5;ctx.beginPath();ctx.arc(e.x,e.y,8+k*38,0,TAU);ctx.stroke();}
      else if(e.type==='shockwave'||e.type==='explosion'){ctx.lineWidth=16*(1-k)+3;ctx.beginPath();ctx.arc(e.x,e.y,e.range*k,0,TAU);ctx.stroke();}
      else if(e.type==='trail'||e.type==='projectileTrail'){ctx.beginPath();ctx.arc(e.x,e.y,(e.size||10)*(1-k),0,TAU);ctx.fill();}
      else if(e.type==='revive'){ctx.beginPath();ctx.arc(e.x+(Math.random()-.5)*40,e.y+(Math.random()-.5)*40,3,0,TAU);ctx.fill();}
      else if(e.type==='dash'||e.type==='laser'||e.type==='lightning'){ctx.lineWidth=e.type==='laser'?22:e.type==='dash'?14:5;ctx.beginPath();ctx.moveTo(e.x1,e.y1);if(e.type==='lightning'){const mx=(e.x1+e.x2)/2+(Math.random()-.5)*18,my=(e.y1+e.y2)/2+(Math.random()-.5)*18;ctx.lineTo(mx,my);}ctx.lineTo(e.x2,e.y2);ctx.stroke();}
      else if(e.type==='crit'){ctx.lineWidth=3;drawStar(e.x,e.y,10+k*16,4+k*7,5);ctx.fill();ctx.strokeStyle='#ffffff';ctx.stroke();}
      else if(e.type==='ringSlash'){ctx.lineWidth=9*(1-k)+2;ctx.beginPath();ctx.arc(e.x,e.y,e.range*(.4+k*.7),0,TAU);ctx.stroke();}
      else if(e.type==='ambushWarning'){ctx.lineWidth=4;ctx.setLineDash([11,8]);const pulse=6+Math.sin(k*Math.PI*7)*6;ctx.beginPath();ctx.arc(e.x,e.y,58+k*26+pulse,0,TAU);ctx.stroke();ctx.setLineDash([]);}
      ctx.restore();
    });
  }

  function drawJoysticks(){input.sticks.forEach((s,i)=>{const color=i?COLORS.p2:COLORS.p1;ctx.save();ctx.globalAlpha=s.active?.55:.16;ctx.fillStyle='rgba(5,8,18,.8)';ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();ctx.arc(s.origin.x,s.origin.y,s.radius,0,TAU);ctx.fill();ctx.stroke();ctx.globalAlpha=s.active?.82:.22;ctx.fillStyle=color;ctx.beginPath();ctx.arc(s.knob.x,s.knob.y,27,0,TAU);ctx.fill();ctx.restore();});}

	function drawBossBar() {
	  const boss = state.enemies.find(
		enemy => enemy.boss && !enemy.dead
	  );

	  if (!boss) return;

	  const canvasRect = canvas.getBoundingClientRect();

	  const hudElements = [
		document.querySelector(".player-one"),
		document.querySelector(".center-hud"),
		document.querySelector(".player-two")
	  ].filter(Boolean);

	  const hudBottom = Math.max(
		...hudElements.map(element => {
		  return element.getBoundingClientRect().bottom;
		})
	  );

	  // Konversi posisi pixel HTML ke koordinat internal canvas.
	  const scaleY = H / canvasRect.height;

	  const hudBottomInCanvas =
		(hudBottom - canvasRect.top) * scaleY;

	  const isMobile =
		window.matchMedia("(pointer: coarse)").matches ||
		window.innerHeight <= 500;

	  const w = isMobile
		? Math.min(470, W * 0.58)
		: Math.min(560, W * 0.55);

	  const x = (W - w) / 2;

	  // Bar selalu berada di bawah bagian HUD yang paling rendah.
		const y = clamp(
		  Math.max(
			isMobile ? 105 : 62,
			hudBottomInCanvas + 18
		  ),
		  62,
		  H * 0.28
		);

	  const barHeight = isMobile ? 16 : 18;

	  ctx.save();

	  ctx.fillStyle = "rgba(0,0,0,.72)";
	  roundedRect(
		x,
		y,
		w,
		barHeight,
		barHeight / 2
	  );
	  ctx.fill();

	  ctx.fillStyle = boss.color;
	  roundedRect(
		x,
		y,
		w * Math.max(0, boss.hp / boss.maxHp),
		barHeight,
		barHeight / 2
	  );
	  ctx.fill();

	  ctx.strokeStyle = "rgba(255,255,255,.5)";
	  ctx.lineWidth = 1.5;
	  roundedRect(
		x,
		y,
		w,
		barHeight,
		barHeight / 2
	  );
	  ctx.stroke();

	  ctx.fillStyle = "#fff";
	  ctx.font = isMobile
		? "800 12px system-ui"
		: "800 13px system-ui";

	  ctx.textAlign = "center";
	  ctx.textBaseline = "bottom";

	  ctx.fillText(
		`${boss.bossName} · Phase ${boss.phase}`,
		W / 2,
		y - 7
	  );

	  ctx.restore();
	}

  function drawMinimap(){
    const m=state.maze;if(!m)return;
    const cell=8,gap=1,padding=9;
    const w=m.cols*(cell+gap)+padding*2,h=m.rows*(cell+gap)+padding*2;
    const x=W-w-14,y=148;
    ctx.save();
    ctx.fillStyle='rgba(4,7,16,.72)';roundedRect(x,y,w,h,10);ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.16)';ctx.lineWidth=1;roundedRect(x,y,w,h,10);ctx.stroke();
    m.cells.forEach(c=>{
      const cx=x+padding+c.col*(cell+gap),cy=y+padding+c.row*(cell+gap);
      let color='rgba(255,255,255,.06)';
      if(c.active&&!c.visited)color='rgba(255,196,90,.78)';
      if(c.visited)color='rgba(140,230,180,.85)';
      if(c.isGoal&&(c.visited||c.active))color='#c9a2ff';
      ctx.fillStyle=color;ctx.fillRect(cx,cy,cell,cell);
    });
    state.players.forEach(p=>{
      const pc=cellAt(p.x,p.y);if(!pc)return;
      const cx=x+padding+pc.col*(cell+gap)+cell/2,cy=y+padding+pc.row*(cell+gap)+cell/2;
      ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(cx,cy,2.6,0,TAU);ctx.fill();
    });
    ctx.restore();
  }

  function moveCircle(obj,dx,dy){
    obj.x+=dx;clampArena(obj);resolveObstacleCollision(obj);resolvePitCollision(obj);
    obj.y+=dy;clampArena(obj);resolveObstacleCollision(obj);resolvePitCollision(obj);
  }
  function clampArena(o){
    const wb=state.maze?state.maze.worldBounds:{x:-2000,y:-2000,w:4000,h:4000};
    o.x=clamp(o.x,wb.x+o.r,wb.x+wb.w-o.r);o.y=clamp(o.y,wb.y+o.r,wb.y+wb.h-o.r);
  }

  function resolveObstacleCollision(o){resolveRectListCollision(o,state.obstacles);}
  function resolvePitCollision(o){if(o.flying)return;resolveRectListCollision(o,state.pits);}
  function resolveRectListCollision(o,rects){
    for(let pass=0;pass<5;pass++){
      let changed=false;
      for(const rect of rects){
        const cx=clamp(o.x,rect.x,rect.x+rect.w),cy=clamp(o.y,rect.y,rect.y+rect.h);let dx=o.x-cx,dy=o.y-cy,d=Math.hypot(dx,dy);if(d>=o.r)continue;changed=true;
        if(d>.0001){const push=o.r-d+.5;o.x+=dx/d*push;o.y+=dy/d*push;}
        else{
          const choices=[{v:Math.abs(o.x-(rect.x-o.r)),x:rect.x-o.r,y:o.y},{v:Math.abs(o.x-(rect.x+rect.w+o.r)),x:rect.x+rect.w+o.r,y:o.y},{v:Math.abs(o.y-(rect.y-o.r)),x:o.x,y:rect.y-o.r},{v:Math.abs(o.y-(rect.y+rect.h+o.r)),x:o.x,y:rect.y+rect.h+o.r}].sort((a,b)=>a.v-b.v)[0];o.x=choices.x;o.y=choices.y;
        }
        clampArena(o);
      }
      if(!changed)break;
    }
  }

  function resolveSeparation(){
    const all=[...state.players.filter(p=>!p.downed),...state.enemies.filter(e=>!e.dead&&e.state!=='entering')];
    for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){
      const a=all[i],b=all[j];let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),min=a.r+b.r+2;
      if(d>0&&d<min){const push=(min-d)/2,nx=dx/d,ny=dy/d;a.x-=nx*push;a.y-=ny*push;b.x+=nx*push;b.y+=ny*push;clampArena(a);clampArena(b);resolveObstacleCollision(a);resolveObstacleCollision(b);resolvePitCollision(a);resolvePitCollision(b);}
    }
  }

  function enforceTether(){
    const[a,b]=state.players;if(!a||!b)return;const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d<=TETHER.max||d===0)return;
    const excess=d-TETHER.max,nx=dx/d,ny=dy/d;a.x+=nx*excess/2;a.y+=ny*excess/2;b.x-=nx*excess/2;b.y-=ny*excess/2;clampArena(a);clampArena(b);resolveObstacleCollision(a);resolveObstacleCollision(b);resolvePitCollision(a);resolvePitCollision(b);
  }

  function updateCamera(dt){
    const[a,b]=state.players;if(!a||!b)return;const midpoint=midpointOfPlayers(),separation=dist(a,b);state.tetherWarning=separation>TETHER.soft;
    const zoomT=clamp(separation/TETHER.max,0,1);state.camera.targetZoom=lerp(1.04,.52,zoomT);const smooth=1-Math.pow(.0015,dt);state.camera.zoom=lerp(state.camera.zoom,state.camera.targetZoom,smooth);
    state.camera.x=lerp(state.camera.x,midpoint.x,smooth);state.camera.y=lerp(state.camera.y,midpoint.y,smooth);
  }

  function placePlayersSafely(){
    const occupied=[];state.players.forEach((p,i)=>{const desired=state.maze.playerStarts[i],valid=findValidPosition(desired.x,desired.y,p.r,occupied);p.x=valid.x;p.y=valid.y;occupied.push(p);resolveObstacleCollision(p);resolvePitCollision(p);});
  }

  function findValidPosition(x,y,r,occupied=[],avoidPits=true){
    const wb=state.maze.worldBounds;
    const valid=(px,py)=>px>wb.x+r&&px<wb.x+wb.w-r&&py>wb.y+r&&py<wb.y+wb.h-r&&!pointInObstacle(px,py,r+8)&&(!avoidPits||!pointInPit(px,py,r+8))&&!occupied.some(o=>Math.hypot(px-o.x,py-o.y)<r+(o.r||20)+24);
    if(valid(x,y))return{x,y};for(let radius=40;radius<=440;radius+=40)for(let step=0;step<20;step++){const a=step/20*TAU,px=x+Math.cos(a)*radius,py=y+Math.sin(a)*radius;if(valid(px,py))return{x:px,y:py};}
    return{x,y};
  }

  function pointInObstacle(x,y,r=0){return state.obstacles.some(o=>x+r>o.x&&x-r<o.x+o.w&&y+r>o.y&&y-r<o.y+o.h);}
  function pointInPit(x,y,r=0){return state.pits.some(o=>x+r>o.x&&x-r<o.x+o.w&&y+r>o.y&&y-r<o.y+o.h);}
  function hasLineOfSight(a,b){const steps=Math.ceil(dist(a,b)/16);for(let i=1;i<steps;i++){const t=i/steps;if(pointInObstacle(lerp(a.x,b.x,t),lerp(a.y,b.y,t),2))return false;}return true;}
  function inCone(p,e,range,angle){if(dist(p,e)>range)return false;return angleToFacing(p,e)<=angle/2;}
  function angleToFacing(p,e){const v=norm({x:e.x-p.x,y:e.y-p.y});return Math.acos(clamp(v.x*p.facing.x+v.y*p.facing.y,-1,1));}
  function insideWorld(p){
    const wb=state.maze?state.maze.worldBounds:{x:-2000,y:-2000,w:4000,h:4000};
    return p.x>wb.x-120&&p.x<wb.x+wb.w+120&&p.y>wb.y-120&&p.y<wb.y+wb.h+120;
  }
  function midpointOfPlayers(){const[a,b]=state.players;return a&&b?{x:(a.x+b.x)/2,y:(a.y+b.y)/2}:{x:0,y:0};}
  function distancePointToSegment(p,a,b){const l2=(b.x-a.x)**2+(b.y-a.y)**2;if(!l2)return dist(p,a);let t=((p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y))/l2;t=clamp(t,0,1);return Math.hypot(p.x-(a.x+t*(b.x-a.x)),p.y-(a.y+t*(b.y-a.y)));}

  function canvasPoint(event){const rect=canvas.getBoundingClientRect();return{x:(event.clientX-rect.left)*W/rect.width,y:(event.clientY-rect.top)*H/rect.height};}
  function pointerDown(e){if(!state.running||state.paused)return;const p=canvasPoint(e),index=p.x<W/2?0:1,s=input.sticks[index];if(s.active)return;s.active=true;s.pointerId=e.pointerId;s.origin={...p};s.knob={...p};s.vector={x:0,y:0};input.pointers.set(e.pointerId,index);canvas.setPointerCapture(e.pointerId);e.preventDefault();}
  function pointerMove(e){const index=input.pointers.get(e.pointerId);if(index===undefined)return;const s=input.sticks[index],p=canvasPoint(e),dx=p.x-s.origin.x,dy=p.y-s.origin.y,d=Math.hypot(dx,dy),m=Math.min(s.radius,d),n=d?{x:dx/d,y:dy/d}:{x:0,y:0};s.knob={x:s.origin.x+n.x*m,y:s.origin.y+n.y*m};s.vector=d<10?{x:0,y:0}:n;e.preventDefault();}
  function pointerUp(e){const index=input.pointers.get(e.pointerId);if(index===undefined)return;const s=input.sticks[index];s.active=false;s.pointerId=null;s.vector={x:0,y:0};s.knob={...s.origin};input.pointers.delete(e.pointerId);e.preventDefault();}

  async function toggleFullscreen(){
    try{if(!document.fullscreenElement&&!document.webkitFullscreenElement){const root=document.documentElement;if(root.requestFullscreen)await root.requestFullscreen();else if(root.webkitRequestFullscreen)root.webkitRequestFullscreen();if(screen.orientation&&screen.orientation.lock)screen.orientation.lock('portrait').catch(()=>{});}else if(document.exitFullscreen)await document.exitFullscreen();else if(document.webkitExitFullscreen)document.webkitExitFullscreen();}catch(_){showToast('Fullscreen tidak didukung browser ini');}
  }
  function updateFullscreenButton(){const active=Boolean(document.fullscreenElement||document.webkitFullscreenElement);dom.fullscreenButton.textContent=active?'Keluar Fullscreen':'Fullscreen';dom.fullscreenButton.setAttribute('aria-pressed',String(active));}

  function toggleSound(){
    window.GameAudio.unlock();
    const enabled=!window.GameAudio.enabled;
    window.GameAudio.setEnabled(enabled);
    window.DungeonMusic?.setVolume?.(enabled?.18:0);
    dom.sound.checked=enabled;
    updateSoundButton();
  }
  function updateSoundButton(){
    const enabled=window.GameAudio.enabled;
    dom.soundToggle.textContent=enabled?'🔊 Sound':'🔇 Muted';
    dom.soundToggle.setAttribute('aria-pressed',String(!enabled));
  }

  function saveCheckpoint(){try{localStorage.setItem('dungeonDuoCheckpoint',JSON.stringify({version:4,level:state.level,score:state.score,difficulty:state.difficulty,seed:state.seed,players:snapshotPlayers()}));dom.continueButton.classList.remove('hidden');}catch(_){} }
  function loadCheckpoint(){try{return JSON.parse(localStorage.getItem('dungeonDuoCheckpoint'));}catch(_){return null;}}
  function clearCheckpoint(){try{localStorage.removeItem('dungeonDuoCheckpoint');}catch(_){} }

  function showToast(text){dom.toast.textContent=text;dom.toast.classList.add('visible');toastTimer=2.2;}
  function sample(array,count){const copy=[...array];for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}return copy.slice(0,count);}
  function mulberry32(a){return function(){let t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
  function drawPolygon(x,y,r,sides,rotation=0){ctx.beginPath();for(let i=0;i<sides;i++){const a=rotation+i/sides*TAU,px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();}
  function drawStar(x,y,outer,inner,points){ctx.beginPath();for(let i=0;i<points*2;i++){const a=-Math.PI/2+i/(points*2)*TAU,r=i%2?inner:outer,px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();}
  function roundedRect(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
  function norm(v){const d=Math.hypot(v.x,v.y)||1;return{x:v.x/d,y:v.y/d};}
  function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
  function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
  function lerp(a,b,t){return a+(b-a)*t;}
  function deg(v){return v*Math.PI/180;}
  function capitalize(s){return s.charAt(0).toUpperCase()+s.slice(1);}
  function hexToRgba(hex,alpha){const v=hex.replace('#','');const full=v.length===3?v.split('').map(x=>x+x).join(''):v;const n=parseInt(full,16);return`rgba(${n>>16},${n>>8&255},${n&255},${alpha})`;}
  function lighten(hex,amount){return shade(hex,amount);}
  function darken(hex,amount){return shade(hex,-amount);}
  function shade(hex,amount){const v=hex.replace('#',''),n=parseInt(v.length===3?v.split('').map(x=>x+x).join(''):v,16),t=amount<0?0:255,p=Math.abs(amount);return`rgb(${Math.round((t-(n>>16))*p+(n>>16))},${Math.round((t-(n>>8&255))*p+(n>>8&255))},${Math.round((t-(n&255))*p+(n&255))})`;}

  function loop(now){const dt=Math.min(.033,(now-lastTime)/1000);lastTime=now;update(dt);render();requestAnimationFrame(loop);}

  canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointermove',pointerMove);canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',pointerUp);
  window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();if(e.code==='KeyF'){e.preventDefault();toggleFullscreen();}input.keys.add(e.code);});
  window.addEventListener('keyup',e=>input.keys.delete(e.code));
  dom.startButton.addEventListener('click',()=>{clearCheckpoint();beginRun(false);});dom.continueButton.addEventListener('click',()=>beginRun(true));dom.restartRun.addEventListener('click',()=>{clearCheckpoint();beginRun(false);});dom.restartLevel.addEventListener('click',restartLevelAssist);dom.sound.addEventListener('change',()=>{window.GameAudio.setEnabled(dom.sound.checked);window.DungeonMusic?.setVolume?.(dom.sound.checked?.18:0);updateSoundButton();});dom.soundToggle.addEventListener('click',toggleSound);dom.fullscreenButton.addEventListener('click',toggleFullscreen);
  dom.victoryContinue.addEventListener('click',()=>{dom.victory.classList.remove('visible');openUpgradeScreen();});
  dom.powerupReroll.addEventListener('click',()=>{
    if(state.powerupRerollsLeft<=0)return;
    state.powerupRerollsLeft--;window.GameAudio.play('uiClick',.2);renderPowerupOptions();
  });
  document.addEventListener('fullscreenchange',updateFullscreenButton);document.addEventListener('webkitfullscreenchange',updateFullscreenButton);updateFullscreenButton();updateSoundButton();if(loadCheckpoint())dom.continueButton.classList.remove('hidden');requestAnimationFrame(loop);
})();
