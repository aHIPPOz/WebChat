// ./src/sandbox.js
export class SandboxRunner {
  static setIframeElement(el) {
  this.iframe = el;
  this.prepareIframe();
  window.addEventListener('message', this.onMessageFromSandbox.bind(this));
}
  static getIframe() {
  return this.iframe;
}
static init() {
  this.iframe = document.createElement("iframe");
  this.iframe.className = "sandboxFrame";
  this.iframeReady = false; // <— état interne

  // prépare le contenu srcdoc
  this.prepareIframe();

  // écoute les messages sandbox
  window.addEventListener('message', this.onMessageFromSandbox.bind(this));

  // ATTEND vraiment le load
  this.iframe.onload = () => {
    this.iframeReady = true;
    console.log("[Sandbox] iframe OK → sync");
    this.syncStateToIframe();      // <— appel correct, maintenant que c’est prêt
  };

  return this;
}


  static prepareIframe() {
    const srcdoc = `<!doctype html><html><head><meta charset="utf-8"></head><body>
      <script>
        const FS = { store: {}, async write(p,c){ this.store[p]=c; return true; }, async read(p){ return this.store[p] ?? null; }, async list(){ return Object.keys(this.store); }, async delete(p){ delete this.store[p]; return true; } };

        const agent = {
          memory: {},
          userFunctions: {},
          math: Math,
          util: { now:()=>Date.now(), uuid:()=>Math.random().toString(36).slice(2,10) },
          fs: {
            write: async (p,c)=>{ return await FS.write(p,c); },
            read: async (p)=>{ return await FS.read(p); },
            list: async ()=>{ return await FS.list(); },
            delete: async (p)=>{ return await FS.delete(p); }
          },
          web: {
            fetch: async (...args) => {
              try { const r = await fetch(...args); const text = await r.text(); return {status: r.status, text}; }
              catch(e){ return {status:0, text:String(e)}; }
            }
          },
          sendHtml: (html)=> parent.postMessage({type:'agent-output-html', html}, '*'),
          sendThinking: (md)=> parent.postMessage({type:'agent-output-thinking', md}, '*'),
          createButton: (label,id)=> parent.postMessage({type:'agent-create-button', label, id}, '*'),
          requestPersistFunction: (name, code)=> parent.postMessage({type:'agent-request-save-fn', name, code}, '*')
        };

        window.agent = agent;

        window.addEventListener('message', async (ev)=>{
          const data = ev.data || {};
          try {
            if (data.type === 'run-code') {
              const wrapped = \`(async function(agent){\n\${data.code}\n})(agent);\`;
              const res = await eval(wrapped);
              parent.postMessage({type:'agent-run-done', result: res ?? null}, '*');
            } else if (data.type === 'set-state') {
              const st = data.state || {};
              agent.memory = st.memory || {};
              agent.userFunctions = st.userFunctions || {};
              parent.postMessage({type:'agent-state-ack'}, '*');
            } else if (data.type === 'agent-button-click') {
              const id = data.id;
              if (agent.buttonHandlers && typeof agent.buttonHandlers[id] === 'function') {
                try { await agent.buttonHandlers[id](); }
                catch(e){ parent.postMessage({type:'agent-run-error', error: String(e)}, '*'); }
              } else {
                parent.postMessage({type:'agent-run-error', error: 'No handler for button '+id}, '*');
              }
            } else if (data.type === 'register-button-handler') {
              const id = data.id;
              const fnCode = data.fnCode || '';
              try {
                // eslint-disable-next-line no-eval
                const fn = eval('(async function(){ return (' + fnCode + ') })()');
                if (!agent.buttonHandlers) agent.buttonHandlers = {};
                Promise.resolve(fn).then(f=> agent.buttonHandlers[id] = f).catch(e=> parent.postMessage({type:'agent-run-error', error: String(e)}, '*'));
              } catch(e) { parent.postMessage({type:'agent-run-error', error: String(e)}, '*'); }
            }
          } catch(e) {
            parent.postMessage({type:'agent-run-error', error: String(e)}, '*');
          }
        }, false);

        parent.postMessage({type:'agent-ready'}, '*');
      <\/script>
    </body></html>`;
    this.iframe.srcdoc = srcdoc;
  }

  static syncStateToIframe() {
  if (!this.iframe || !this.iframe.contentWindow || !this.iframeReady) {
    console.warn("[Sandbox] iframe pas encore prête → sync ignoré");
    return;
  }

  try {
    const state =
      window.__AGENT_APP.Persistence.getAgentState?.() ||
      { memory:{}, userFunctions:{} };

    this.iframe.contentWindow.postMessage(
      { type: 'set-state', state },
      '*'
    );
  } catch(e) {
    console.warn("syncStateToIframe failed", e);
  }
}

  static runCode(code) {
    // 1) afficher une bulle assistant
    const bubble = window.__AGENT_APP.UI.appendBubble({
        role:'assistant',
        name: 'agent',
        content: "<b>Sandbox execution:</b>"
    });

    // 2) insérer l’iframe DANS cette bulle
    if (this.iframe.parentNode) {
  this.iframe.parentNode.removeChild(this.iframe);
}
    bubble.appendChild(this.iframe);

    // 3) envoyer le code dans l’iframe
    this.iframe.contentWindow.postMessage({type:'run-code', code}, '*');
}

  static onMessageFromSandbox(ev) {
    const d = ev.data || {};
    if (d.type === 'agent-ready') {
      console.log('sandbox ready');
      // initial sync
      SandboxRunner.syncStateToIframe();
    } else if (d.type === 'agent-output-html') {
      window.__AGENT_APP.UI.appendBubble({ role:'assistant', name: 'agent', content: d.html });
    } else if (d.type === 'agent-output-thinking') {
      window.__AGENT_APP.UI.appendBubble({ role:'assistant', name: 'agent', content: '', expandableThinking: d.md });
    } else if (d.type === 'agent-create-button') {
      const id = d.id || ('btn_'+Math.random().toString(36).slice(2,7));
      const btn = document.createElement('button');
      btn.textContent = d.label || 'Btn';
      btn.className = 'smallbtn';
      btn.onclick = ()=> {
        SandboxRunner.iframe.contentWindow.postMessage({type:'agent-button-click', id}, '*');
      };
      window.__AGENT_APP.UI.appendBubble({ role:'assistant', name: 'agent', content: '', meta: 'UI Button' });
      window.__AGENT_APP.UI.messagesEl.lastChild.appendChild(btn);
    } else if (d.type === 'agent-request-save-fn') {
      const name = d.name; const code = d.code;
      const ok = confirm("L'agent propose de sauvegarder une nouvelle fonction persistante '"+name+"'. Autoriser ?");
      if (ok) {
        window.__AGENT_APP.Persistence.addUserFunction(name, code);
        alert("Fonction '"+name+"' sauvegardée.");
        SandboxRunner.syncStateToIframe();
      } else {
        alert("Rejeté.");
      }
    } else if (d.type === 'agent-run-done') {
      if (d.result !== undefined && d.result !== null) {
        window.__AGENT_APP.UI.appendBubble({role:'assistant', name:'agent', content: `<pre class="codeBlock">${String(d.result)}</pre>`});
      }
    } else if (d.type === 'agent-run-error') {
      window.__AGENT_APP.UI.appendBubble({role:'assistant', name:'agent', content: `<pre class="codeBlock">Erreur: ${d.error}</pre>`});
    } else if (d.type === 'agent-state-ack') {
      console.log('iframe acknowledged state');
    }
  }
}
