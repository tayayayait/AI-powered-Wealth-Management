export const CHATBOT_OPEN_EVENT = "wealth:chatbot-open";

export interface ChatbotOpenEventDetail {
  prefill?: string;
}

export function openChatbot(detail: ChatbotOpenEventDetail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ChatbotOpenEventDetail>(CHATBOT_OPEN_EVENT, { detail }));
}
