// ./src/model.js
import * as webllm from "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.80/+esm";

// 🔥 Le SYSTEM doit être défini en dehors de la classe
const SYSTEM = `
Tu es un agent OUTILLÉ. 
Tu NE peux répondre **QUE** avec un JSON strict valide. Jamais de texte autour.
MarkDown → JSON strict.
Format obligatoire :

{
  "thinking": "...",
  "result_js": "...",
  "tools": []
}

AUCUN TEXTE hors JSON.
AUCUNE phrase avant/après.
SI tu veux réfléchir, tu le mets dans "thinking" sous format MakrDown complet.
`;

export class ModelManager {

  static async populateModelSelect() {
    try {
      const list = webllm.prebuiltAppConfig?.model_list || [
        {model_id:"Llama-3.1-8B-Instruct-q4f32_1-MLC"},
        {model_id:"Phi-3-mini-4k-instruct-q4f16_1-MLC"}
      ];
      const sel = document.getElementById("modelSelect");
      sel.innerHTML = "";
      list.forEach(m=>{
        const opt = document.createElement("option");
        opt.value = m.model_id;
        opt.textContent = m.model_id;
        sel.appendChild(opt);
      });
    } catch(e) {
      console.warn("populateModelSelect", e);
    }
  }

  static async loadModel(id, onProgress = ()=>{}) {
    if (!id) throw new Error("model id required");
    window.__AGENT_APP_MODEL = id;
    window.__AGENT_APP.UI.setModelText("Chargement: " + id);
    const engine = await webllm.CreateMLCEngine(id, {
      initProgressCallback: (p)=> onProgress(p)
    });
    window.__AGENT_APP.ENGINE = engine;
    window.__AGENT_APP.UI.setModelText("Modèle: " + id);
    window.__AGENT_APP.UI.appendSimpleAssistant('Modèle chargé ✔');
    return engine;
  }

  static buildSystemPrompt() {
    const soft = `
Règles:
- Réponds en JSON EXACT, minimalement : { "thinking": "...", "tools": [ ... ], "result_js": "..." }
- "tools" (optionnel) est une liste d'actions que tu demandes au runtime d'exécuter (voir doc).
- "result_js" peut être vide "" si aucun JS à exécuter.
- Si tu veux sauvegarder une fonction persistante, émet un tool { "name":"persist_fn", "args": {"fn_name":"x","code":"..."} }.
- Toujours fournir un "thinking" (markdown) pour expliquer la démarche.
`;
    return `Tu es un AGENT qui répond en JSON strict. ${soft} ${SYSTEM}`;
  }

  static async ask(userText) {
    const engine = window.__AGENT_APP.ENGINE;
    if (!engine) throw new Error("no model loaded");

    const history = []; // ⚠️ ton code demandait "history.unshift" mais history n'existait pas
    history.unshift({ role: "system", content: SYSTEM });

    const messages = [
      { role:"system", name:"agent_system", content: ModelManager.buildSystemPrompt() },
      { role:"user", name: window.__AGENT_APP_USERNAME || "User", content: userText }
    ];

    const chunks = await engine.chat.completions.create({ messages, stream: true });
    let buffer = "";
    for await (const c of chunks) {
      const delta = c.choices?.[0]?.delta?.content || '';
      buffer += delta;
    }
    return buffer;
  }

  static parseJsonLenient(s) {
    if (!s) return null;
    s = s.replace(/```json|```/g, '');
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    const substr = s.slice(start, end+1);
    try { return JSON.parse(substr); }
    catch(e) {
      try {
        const repaired = substr.replace(/,(\s*[}\]])/g, '$1');
        return JSON.parse(repaired);
      } catch(e2) { return null; }
    }
  }
}
// --- FIN DU FICHIER model.js ---