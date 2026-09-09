const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const source=readFileSync(`${__dirname}/../static/js/running-route.js`,'utf8');
function route(url,missing=false) {
  let redirect,restored;
  vm.runInNewContext(source,{
    URL,
    document:{documentElement:{dataset:{runningNotFound:missing?'true':undefined}}},
    window:{location:{href:url,replace:url=>redirect=url},history:{replaceState:(_s,_t,url)=>restored=url}},
  });
  return {redirect,restored};
}
test('unknown running deep links preserve queries and hashes through the entry page',()=>{
  const original='https://example.test/running/summary/2025?type=running&title=%E8%B7%91#page-2';
  const redirect=route(original,true).redirect;
  assert.equal(new URL(redirect).pathname,'/running/');
  assert.equal(route(redirect).restored,original.replace('https://example.test',''));
});
test('blog 404 and a missing running entry never enter a redirect loop',()=>{
  for(const p of ['/posts/missing','/missing','/running/']) assert.equal(route('https://example.test'+p,true).redirect,undefined);
});
test('untrusted restore parameters cannot escape the running namespace or origin',()=>{
  for(const p of ['https://evil.test/running/','//evil.test/running/','/posts/','/running/../posts/','http://[']) {
    assert.equal(route('https://example.test/running/?__running_path='+encodeURIComponent(p)).restored,'/running/');
  }
});
