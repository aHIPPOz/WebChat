// ./src/ui/main.js
export class UIManager {
  constructor() {
    this.messagesEl = document.getElementById("messages");
    this.currentModelEl = document.getElementById("currentModel");
    this.toolsListEl = document.getElementById("toolsList");
  }

  setModelText(text) {
    this.currentModelEl.textContent = text;
  }

  clearMessages() {
    this.messagesEl.innerHTML = "";
  }

  appendBubble({role,name,content,meta=null,expandableThinking=null,codeToValidate=null,rawJSON=null}) {
    const container = document.createElement("div");
    container.className = "bubble " + (role === "user" ? "user" : "assistant");

    if (meta) {
      const m = document.createElement("div");
      m.className = "meta";
      m.textContent = `${name || (role==='user'?'You':'Agent')} · ${meta}`;
      container.appendChild(m);
    }

    if (expandableThinking) {
      const thinkingLine = document.createElement("div");
      thinkingLine.innerHTML = `<span class="thinking-line">Thinking… (cliquer pour voir)</span>`;
      container.appendChild(thinkingLine);

      const thinkingBox = document.createElement("div");
      thinkingBox.className = "thinking-box";
      thinkingBox.style.display = "none";
      thinkingBox.innerHTML = UIManager.renderTinyMarkdown(expandableThinking);
      container.appendChild(thinkingBox);

      thinkingLine.onclick = () => {
        thinkingBox.style.display = thinkingBox.style.display === "none" ? "block" : "none";
      };
    }

    const contentNode = document.createElement("div");
    contentNode.style.marginTop = "8px";

    if (role === "user") {
      contentNode.textContent = content;
      container.appendChild(contentNode);
    } else {
      if (codeToValidate) {
        const pre = document.createElement("pre");
        pre.className = "codeBlock";
        pre.textContent = codeToValidate;
        container.appendChild(pre);

        const actions = document.createElement("div");
        actions.className = "codeActions";
        const allowBtn = document.createElement("button");
        allowBtn.textContent = "Autoriser & Exécuter";
        const rejectBtn = document.createElement("button");
        rejectBtn.textContent = "Rejeter";
        rejectBtn.className = "smallbtn";
        actions.appendChild(allowBtn);
        actions.appendChild(rejectBtn);
        const info = document.createElement("div");
        info.className = "muted";
        info.textContent = "Le code s'exécutera dans un sandbox isolé. Il peut appeler l'API `agent` fournie.";

        container.appendChild(actions);
        container.appendChild(info);

        allowBtn.onclick = () => {
          allowBtn.disabled = true;
          allowBtn.textContent = "Exécuté";
          // dispatch a custom event to let higher-level code run it
          window.dispatchEvent(new CustomEvent('ui:executeCode', { detail: { code: codeToValidate, rawJSON } }));
        };

        rejectBtn.onclick = () => {
          actions.remove();
          const rej = document.createElement("div");
          rej.textContent = "Exécution refusée.";
          container.appendChild(rej);
        };
      } else {
        // --- PATCH IFRAME DYNAMIQUE (utilise l'iframe gérée par SandboxRunner) ---
if (content && content.includes("<iframe")) {
  // If sandbox exists and has an iframe, append that iframe instance into the message bubble.
  const sb = window.__AGENT_APP?.SANDBOX;
  if (sb && sb.iframe) {
    const iframeEl = sb.iframe;

    // ensure iframe has expected styling and sandbox attributes
    iframeEl.style.width = "100%";
    iframeEl.style.height = iframeEl.style.height || "300px";
    iframeEl.style.border = "none";
    iframeEl.setAttribute("sandbox", "allow-scripts allow-same-origin");

    contentNode.appendChild(iframeEl);
    container.appendChild(contentNode);
    this.messagesEl.appendChild(container);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    return container;
  } else {
    // fallback: no sandbox yet; show placeholder explaining why iframe not embedded
    contentNode.textContent = "[Sandbox non prêt — iframe non insérée]";
    container.appendChild(contentNode);
    this.messagesEl.appendChild(container);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    return container;
  }
}
// --- FIN PATCH ---

        contentNode.innerHTML = content;
        container.appendChild(contentNode);
      }
    }

    this.messagesEl.appendChild(container);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    return container;
  }

  appendSimpleAssistant(text) {
    this.appendBubble({role:'assistant', name:'system', content:text, meta: new Date().toLocaleString()});
  }

  populateToolsList(userFunctions) {
    this.toolsListEl.innerHTML = "";
    for (const [k, code] of Object.entries(userFunctions||{})) {
      const row = document.createElement("div");
      row.style.display="flex"; row.style.justifyContent="space-between"; row.style.gap="8px"; row.style.alignItems="center";
      const name = document.createElement("div"); name.textContent = k; name.className="badge";
      const btn = document.createElement("button"); btn.textContent="Voir / Supprimer"; btn.className="smallbtn";
      btn.onclick = ()=>{
        const confirmed = confirm("Supprimer la fonction persistante '"+k+"' ? Annuler pour l'afficher.");
        if(confirmed){
          window.dispatchEvent(new CustomEvent('ui:deleteFn', { detail: { name:k } }));
        } else {
          alert(code);
        }
      }
      row.appendChild(name); row.appendChild(btn);
      this.toolsListEl.appendChild(row);
    }
  }

  static renderTinyMarkdown(md){
    let s = md || "";
    s = s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    s = s.replace(/```([\s\S]*?)```/g, (m,p)=> `<pre class="codeBlock" style="white-space:pre-wrap">${p}</pre>`);
    s = s.replace(/`([^`]+)`/g,"<code>$1</code>");
    s = s.replace(/^### (.*$)/gim, "<h3>$1</h3>");
    s = s.replace(/^## (.*$)/gim, "<h2>$1</h2>");
    s = s.replace(/^# (.*$)/gim, "<h1>$1</h1>");
    s = s.replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>");
    s = s.replace(/\*(.*?)\*/g,"<em>$1</em>");
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    s = s.replace(/\n/g,"<br>");
    return s;
  }
}

export const UI = new UIManager();
