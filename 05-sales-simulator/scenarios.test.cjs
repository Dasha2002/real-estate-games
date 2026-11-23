const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

let handler;
let result;
const root = {innerHTML:'',querySelector(){return null}};
const Game = {
  root,
  action(label,name,value){return `<button data-action="${name}" data-value="${value}">${label}</button>`},
  reward(options){result=options;return `<section>${options.title}${options.extra}</section>`},
  init(options){handler=options;options.restart()}
};
const context=vm.createContext({Game});
vm.runInContext(fs.readFileSync(__dirname+'/script.js','utf8'),context);
const cases=vm.runInContext('cases',context);
assert.equal(cases.length,6);

for(const person of cases){
  assert.equal(person.stages.length,5,person.name);
  for(const stage of [...person.stages,person.repair]){
    assert.ok(stage.question && stage.topic && stage.hint);
    assert.equal(stage.options.length,3,person.name+' · '+stage.topic);
    assert.deepEqual([...stage.options.map(option=>option.level)].sort(),[0,1,2]);
    assert.equal(new Set(stage.options.map(option=>option.text)).size,3);
    for(const option of stage.options) assert.ok(option.reaction && option.feedback);
  }
}

// Strong choices retain the planned third question and earn only their actual points.
handler.onAction('customer','0');
for(let i=0;i<5;i++){
  handler.onAction('reply','0');
  if(i===1) assert.equal(vm.runInContext('currentStage()===customer.repair',context),false);
  handler.onAction('next','');
}
assert.equal(result.score,100);
assert.match(result.detail,/5 из 5/);

// Two risky choices trigger the concern branch; a later strong reply can recover trust.
handler.restart();
handler.onAction('customer','0');
for(let i=0;i<2;i++){handler.onAction('reply','2');handler.onAction('next','');}
assert.equal(vm.runInContext('currentStage()===customer.repair',context),true);
assert.match(root.innerHTML,/главному сомнению/);
handler.onAction('reply','0');
assert.match(root.innerHTML,/Вот это поможет принять решение/);
assert.equal(vm.runInContext('trust',context),34);
handler.onAction('next','');
for(let i=3;i<5;i++){handler.onAction('reply','0');handler.onAction('next','');}
assert.equal(result.score,60);
assert.match(result.extra,/Рискованное решение/);

// A partial response advances the conversation without earning full credit.
handler.restart();
handler.onAction('customer','1');
handler.onAction('reply','1');
assert.equal(vm.runInContext('trust',context),47);
assert.equal(vm.runInContext('interest',context),40);
assert.match(root.innerHTML,/Для гостей отлично/);
assert.match(root.innerHTML,/10 баллов/);
handler.onAction('next','');
handler.onAction('hint','');
assert.match(root.innerHTML,/Ориентир/);
const orders=new Set();
for(let person=0;person<cases.length;person++) for(let step=0;step<5;step++)
  orders.add(vm.runInContext(`customer=cases[${person}];index=${step};optionOrder().join('')`,context));
assert.ok(orders.size>=3,'Choice positions must vary');
console.log('PASS: six customer types, 30 stages, three meaningful choices per stage, trust branch and outcome scoring.');
