import { describe, expect, it, beforeEach } from 'vitest';
import { Window } from 'happy-dom';
import { Adapter } from '@senda/adapter-schema';
import { render } from '../src/core/adapters/template';
import { runRecipe } from '../src/injected/runner';
import chat from './fixtures/adapters/fixturechat.json';

describe('recipe runner',()=>{
 beforeEach(()=>{const w=new Window();Object.assign(globalThis,{window:w,document:w.document,location:w.location,HTMLElement:w.HTMLElement,HTMLInputElement:w.HTMLInputElement,HTMLTextAreaElement:w.HTMLTextAreaElement,HTMLSelectElement:w.HTMLSelectElement,HTMLFormElement:w.HTMLFormElement,MouseEvent:w.MouseEvent,KeyboardEvent:w.KeyboardEvent,Event:w.Event,CSS:{escape:(s:string)=>s}})});
 it('renders raw values and interpolated strings',()=>expect([render('{{args.n}}',{args:{n:3},vars:{},now:1}),render('x{{vars.a}}',{args:{},vars:{a:'y'},now:1})]).toEqual([3,'xy']));
 it('validates fixture and reports variant selector breakage',async()=>{const a=Adapter.parse(chat);document.body.innerHTML='<article class="chat-row">row</article>';const result=await runRecipe({adapter:a,tool:'list_chats',args:{}});expect(result).toMatchObject({ok:false,code:'ADAPTER_BROKEN'});});
 it('blocks sensitive click in read tool',async()=>{const a=Adapter.parse({...chat,tools:{click_send:{description:'x',effect:'read',params:{},steps:[{click:{selector:'button'}}]}}});document.body.innerHTML='<button>Send</button>';expect(await runRecipe({adapter:a,tool:'click_send',args:{}})).toMatchObject({ok:false,code:'READ_ONLY'});});
});
