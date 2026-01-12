// ./src/persistence.js
export const STORAGE_KEYS = {
  HISTORY: "webllm_agent_history_v3",
  AGENT_STATE: "webllm_agent_state_v3",
  USERNAME: "webllm_agent_username_v3"
};

let chatHistory = []; // local in module
let agentState = {
  memory: {},
  userFunctions: {}
};

export class Persistence {
  static load() {
    const h = localStorage.getItem(STORAGE_KEYS.HISTORY);
    if (h) chatHistory = JSON.parse(h);
    const st = localStorage.getItem(STORAGE_KEYS.AGENT_STATE);
    if (st) agentState = JSON.parse(st);
    const username = localStorage.getItem(STORAGE_KEYS.USERNAME);
    if (username) window.__AGENT_APP_USERNAME = username;

    // replay history if UI exists
    if (window.__AGENT_APP && window.__AGENT_APP.UI) {
      window.__AGENT_APP.UI.clearMessages();
      chatHistory.forEach(msg => window.__AGENT_APP.UI.appendBubble(msg));
      window.__AGENT_APP.UI.populateToolsList(agentState.userFunctions);
    }
  }

  static saveHistory() {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(chatHistory));
  }

  static pushHistory(msg) {
    chatHistory.push(msg);
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(chatHistory));
  }

  static getHistory() { return chatHistory; }

  static getAgentState() { return agentState; }

  static saveAgentState() {
    localStorage.setItem(STORAGE_KEYS.AGENT_STATE, JSON.stringify(agentState));
    if (window.__AGENT_APP && window.__AGENT_APP.UI) {
      window.__AGENT_APP.UI.populateToolsList(agentState.userFunctions);
    }
  }

  static clearHistory() {
    chatHistory = [];
    localStorage.removeItem(STORAGE_KEYS.HISTORY);
  }

  static resetAgentState() {
    agentState = { memory: {}, userFunctions: {} };
    localStorage.removeItem(STORAGE_KEYS.AGENT_STATE);
    if (window.__AGENT_APP && window.__AGENT_APP.UI) {
      window.__AGENT_APP.UI.populateToolsList(agentState.userFunctions);
    }
  }

  static saveUserName(name) {
    localStorage.setItem(STORAGE_KEYS.USERNAME, name);
  }

  static addUserFunction(name, code) {
    agentState.userFunctions[name] = code;
    Persistence.saveAgentState();
  }

  static deleteUserFunction(name) {
    delete agentState.userFunctions[name];
    Persistence.saveAgentState();
  }
}
