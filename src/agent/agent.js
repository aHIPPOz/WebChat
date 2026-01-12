// ./src/agent.js
export class Agent {
  static autoRun = false;

  static setAutoRun(v) { Agent.autoRun = !!v; }

  // main send function: ask model, parse JSON, show thinking, show code preview, handle tools
  static async sendUserMessage(text) {
    if (!window.__AGENT_APP.ENGINE) { alert("Charge un modèle d'abord"); return; }
    if (!window.__AGENT_APP_USERNAME) {
      const name = prompt("Pseudo (sera sauvegardé localement):") || "User";
      window.__AGENT_APP_USERNAME = name;
      window.__AGENT_APP.Persistence.saveUserName(name);
    }

    // store user message in history & UI
    const userMsg = { role:'user', name: window.__AGENT_APP_USERNAME, content: text, meta: new Date().toLocaleString() };
    window.__AGENT_APP.Persistence.pushHistory(userMsg);
    window.__AGENT_APP.UI.appendBubble(userMsg);

    // query model
    let raw;
    try {
      raw = await window.__AGENT_APP.ModelManager.ask(text);
    } catch(e) {
      window.__AGENT_APP.UI.appendSimpleAssistant("Erreur model: "+String(e));
      return;
    }

    // parse JSON
    const parsed = window.__AGENT_APP.ModelManager.parseJsonLenient(raw);
    if (!parsed) {
   window.__AGENT_APP.UI.appendBubble({ role:'assistant', name: window.__AGENT_APP_MODEL, content: "⚠️ Réponse non JSON — vérifie ton prompt système.\n\n" + raw });
      window.__AGENT_APP.Persistence.pushHistory({role:'assistant', name: window.__AGENT_APP_MODEL||'agent', content: raw, meta: new Date().toLocaleString()});
      return;
    }

    // push assistant raw
    window.__AGENT_APP.Persistence.pushHistory({role:'assistant', name: window.__AGENT_APP_MODEL||'agent', content: raw, meta: new Date().toLocaleString()});

    // show thinking and preview code
    const thinking = parsed.thinking || "";
    const result_js = parsed.result_js || "";
    const tools = parsed.tools || [];
    window.__AGENT_APP.UI.appendBubble({ role:'assistant', name: window.__AGENT_APP_MODEL||'agent', content: '', expandableThinking: thinking, codeToValidate: result_js, rawJSON: parsed });

    // handle tools immediately if present (tools are instructions for the runtime)
    if (Array.isArray(tools) && tools.length) {
      for (const t of tools) {
        await Agent.handleTool(t).catch(e=>{
          window.__AGENT_APP.UI.appendSimpleAssistant("Erreur tool: "+String(e));
        });
      }
    }

    // if result_js provided and autoRun is true, auto-execute
    if (result_js && Agent.autoRun) {
      // run directly, bypassing user click
      window.__AGENT_APP.SandboxRunner.runCode(result_js);
    }
  }

  // tool handler: supports some builtin tool names (persist_fn, run_js_direct, send_message, fs_write, create_button)
  static async handleTool(toolObj) {
    const name = toolObj.name || toolObj.tool || "";
    const args = toolObj.args || {};
    switch(name) {
      case 'persist_fn':
      case 'save_function':
        {
          const fnName = args.fn_name || args.name;
          const code = args.code || args.fn || "";
          if (!fnName || !code) throw new Error("persist_fn missing fields");
          const ok = confirm("L'agent propose de sauvegarder la fonction '"+fnName+"'. Autoriser ?");
          if (ok) {
            window.__AGENT_APP.Persistence.addUserFunction(fnName, code);
            window.__AGENT_APP.UI.appendSimpleAssistant("Fonction '"+fnName+"' sauvegardée.");
            window.__AGENT_APP.SandboxRunner.syncStateToIframe();
          }
        }
        break;

      case 'run_js_direct':
      case 'run_js':
        {
          const code = args.code || "";
          if (!code) throw new Error("run_js missing code");
          // execute in sandbox (requires user approval typically)
          const approved = Agent.autoRun || confirm("L'agent demande d'exécuter du JS dans le sandbox. Autoriser ?");
          if (approved) {
            window.__AGENT_APP.SandboxRunner.runCode(code);
          }
        }
        break;

      case 'fs_write':
        {
          const path = args.path;
          const content = args.content;
          if (!path) throw new Error("fs_write missing path");
          // persist to agentState.userFunctions or agentState.memory? Use FS inside sandbox; we can proxy via sandbox
          const code = `await agent.fs.write(${JSON.stringify(path)}, ${JSON.stringify(content)}); return "written:${path}";`;
          window.__AGENT_APP.SandboxRunner.runCode(code);
        }
        break;

      case 'create_button':
        {
          const label = args.label || 'Btn';
          const id = args.id || ('btn_'+Math.random().toString(36).slice(2,7));
          // send create button message from sandbox side; easiest: instruct sandbox to post agent.createButton
          const code = `agent.createButton(${JSON.stringify(label)}, ${JSON.stringify(id)});`;
          window.__AGENT_APP.SandboxRunner.runCode(code);
        }
        break;

      default:
        throw new Error("Tool inconnu: "+name);
    }
  }
}

// listen to UI execute events
window.addEventListener('ui:executeCode', (ev) => {
  const { code } = ev.detail || {};
  if (code) {
    window.__AGENT_APP.SandboxRunner.runCode(code);
  }
});

// deletion event for user functions
window.addEventListener('ui:deleteFn', (ev) => {
  const { name } = ev.detail || {};
  if (name) {
    window.__AGENT_APP.Persistence.deleteUserFunction(name);
    window.__AGENT_APP.UI.appendSimpleAssistant("Fonction '"+name+"' supprimée.");
    window.__AGENT_APP.SandboxRunner.syncStateToIframe();
  }
});
