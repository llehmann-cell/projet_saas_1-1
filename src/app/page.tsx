"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";

type Message = {
  id: string;
  role: "user" | "ai";
  content: string;
  score?: number;
  tags?: string[];
  nextStep?: string;
  stage?: number;
  stageTitle?: string;
};

type AdviceResponse = Pick<Message, "content" | "score" | "tags" | "nextStep" | "stage" | "stageTitle">;

const promptSuggestions = [
  "Une app qui aide les freelances a relancer leurs prospects",
  "Un CRM ultra simple pour cabinets d'avocats",
  "Un outil IA qui transforme les notes de reunion en plan d'action",
];

const interviewStages = [
  "Idee",
  "Client",
  "Douleur",
  "Solution",
  "Marche",
  "Concurrence",
  "Innovation",
  "Business model",
  "Acquisition",
  "Execution",
];

const fallbackQuestions = [
  "Explique ton idee en une phrase simple: pour qui, quel probleme, quel resultat concret ?",
  "Qui est ton client ideal exactement ? Donne un profil precis, pas juste une categorie large.",
  "Quelle douleur urgente il ressent aujourd'hui, et comment il la gere sans ton produit ?",
  "Quelle est ta solution concrete, et quelle partie serait vraiment indispensable en version 1 ?",
  "Quelle taille de marche vises-tu, meme approximativement, et sur quelle niche tu commences ?",
  "Qui sont les alternatives directes ou indirectes, et pourquoi un client changerait pour toi ?",
  "Qu'est-ce qui est vraiment nouveau dans ton approche, au-dela de mettre de l'IA dedans ?",
  "Qui paie, combien, a quelle frequence, et pourquoi le prix serait acceptable ?",
  "Quel canal peut te donner tes 20 premiers utilisateurs sans gros budget publicitaire ?",
  "Quelles sont les 3 prochaines actions concretes sur 14 jours pour prouver ou tuer l'idee ?",
];

function buildFallbackAdvice(messages: Message[]): Message {
  const userMessages = messages.filter((message) => message.role === "user");
  const latestAnswer = userMessages.at(-1)?.content ?? "";
  const isVague = latestAnswer.trim().length < 42 || /je sais pas|jsp|vague|aucune idee|peut-etre/i.test(latestAnswer);
  const substantiveAnswers = userMessages.filter((message) => message.content.trim().length >= 42).length;
  const stageIndex = Math.min(isVague ? Math.max(0, substantiveAnswers - 1) : substantiveAnswers, interviewStages.length - 1);
  const score = Math.min(92, 34 + substantiveAnswers * 6 + Math.min(20, Math.floor(latestAnswer.length / 22)));

  if (substantiveAnswers >= interviewStages.length && !isVague) {
    return {
      id: crypto.randomUUID(),
      role: "ai",
      score,
      stage: interviewStages.length,
      stageTitle: "Synthese",
      tags: ["synthese", "decision", "plan 14 jours"],
      content:
        "Tu as assez de matiere pour faire un premier tri serieux. Avis tranche: ne construis pas toute l'app maintenant. Construis uniquement le test qui prouve que la douleur est forte, que le client existe, et que quelqu'un accepte de payer.",
      nextStep:
        "Resume ta promesse, cree une page de precommande ou une demo cliquable, puis fais 10 appels clients. Si personne ne s'engage concretement, change la cible ou la douleur.",
    };
  }

  return {
    id: crypto.randomUUID(),
    role: "ai",
    score,
    stage: stageIndex + 1,
    stageTitle: interviewStages[stageIndex],
    tags: [isVague ? "a preciser" : "question suivante", "entretien", interviewStages[stageIndex].toLowerCase()],
    content: `${
      isVague
        ? "Ta reponse est encore trop floue pour prendre une decision utile. Je reformule au lieu de faire semblant d'avoir compris."
        : "On avance. Ce que tu viens de dire donne une piste, mais il faut maintenant attaquer l'angle mort suivant."
    }\n\nPourquoi c'est important: sans cette reponse, ton projet peut avoir l'air interessant mais rester impossible a vendre, positionner ou tester.`,
    nextStep: fallbackQuestions[stageIndex],
  };
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init",
      role: "ai",
      stage: 1,
      stageTitle: "Idee",
      tags: ["10 questions", "sans filtre", "personnalise"],
      content:
        "On va faire ca serieusement: je te pose une dizaine de questions, une par une. Si ta reponse est vague, je reformule au lieu de faire semblant d'avoir compris. A la fin, tu repars avec un avis tranche sur ton business plan, ton marche, ton innovation et tes prochains tests.",
      nextStep: fallbackQuestions[0],
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatHistoryRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const userAnswerCount = useMemo(() => messages.filter((message) => message.role === "user").length, [messages]);
  const progress = Math.min(userAnswerCount + 1, interviewStages.length);

  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submitIdea(input);
  };

  const submitIdea = (idea: string) => {
    const trimmedIdea = idea.trim();
    if (!trimmedIdea || isTyping) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmedIdea,
    };

    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");
    setIsTyping(true);

    fetch("/api/advice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: nextMessages.map((message) => ({
          role: message.role,
          content: message.content,
          stage: message.stage,
          stageTitle: message.stageTitle,
        })),
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Advice request failed");
        }

        return response.json() as Promise<AdviceResponse>;
      })
      .then((advice) => {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "ai",
            ...advice,
          },
        ]);
      })
      .catch(() => {
        setMessages((prev) => [...prev, buildFallbackAdvice(nextMessages)]);
      })
      .finally(() => {
        setIsTyping(false);
      });
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <section className={styles.workspace} aria-label="Diagnostic de projet">
          <aside className={styles.panel}>
            <div>
              <p className={styles.eyebrow}>Avis Tranche</p>
              <h1 className={styles.title}>Ton idee passe au banc d&apos;essai.</h1>
              <p className={styles.subtitle}>
                Un entretien en 10 questions pour challenger le business plan, le marche, la concurrence, l&apos;innovation et le plan d&apos;execution.
              </p>
              <button className={styles.cta} type="button" onClick={() => inputRef.current?.focus()}>
                Commencer l&apos;entretien
              </button>
            </div>

            <div className={styles.progressPanel} aria-label="Progression de l'entretien">
              <div className={styles.progressHeader}>
                <span>Parcours</span>
                <strong>{progress}/10</strong>
              </div>
              <div className={styles.progressBar}>
                <span style={{ width: `${progress * 10}%` }} />
              </div>
              <div className={styles.stageList}>
                {interviewStages.map((stage, index) => (
                  <span className={index < progress ? styles.stageDone : undefined} key={stage}>
                    {index + 1}. {stage}
                  </span>
                ))}
              </div>
            </div>

            <div className={styles.suggestions} aria-label="Exemples de projets">
              {promptSuggestions.map((suggestion) => (
                <button
                  className={styles.suggestion}
                  key={suggestion}
                  onClick={() => submitIdea(suggestion)}
                  type="button"
                  disabled={isTyping}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </aside>

          <div className={styles.chatBox}>
            <div className={styles.chatHeader}>
              <div>
                <p className={styles.chatLabel}>Diagnostic live</p>
                <h2>Entretien business plan</h2>
              </div>
              <span className={styles.status}>{isTyping ? "Analyse" : "Pret"}</span>
            </div>

            <div className={styles.chatHistory} ref={chatHistoryRef}>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`${styles.messageWrapper} ${
                    msg.role === "user" ? styles.messageUserWrapper : styles.messageAiWrapper
                  }`}
                >
                  <div className={`${styles.message} ${msg.role === "user" ? styles.userMessage : styles.aiMessage}`}>
                    {msg.score !== undefined && msg.score > 0 && (
                      <div className={styles.scoreRow}>
                        <span>{msg.stageTitle ?? "Score"}</span>
                        <strong>{msg.score}/100</strong>
                      </div>
                    )}
                    {msg.stage && msg.stageTitle && msg.score === undefined && (
                      <div className={styles.stageBadge}>
                        Question {msg.stage}/10 · {msg.stageTitle}
                      </div>
                    )}
                    <p>{msg.content}</p>
                    {msg.tags && (
                      <div className={styles.tags}>
                        {msg.tags.map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                    )}
                    {msg.nextStep && (
                      <div className={styles.nextStep}>
                        <span>{msg.stage ? "Question suivante" : "Prochaine action"}</span>
                        {msg.nextStep}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className={`${styles.messageWrapper} ${styles.messageAiWrapper}`}>
                  <div className={`${styles.message} ${styles.aiMessage}`}>
                    <p className={styles.typing}>Analyse en cours...</p>
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className={styles.inputForm}>
              <textarea
                className={styles.input}
                placeholder="Reponds librement. Si c'est vague, l'IA reformulera et creusera."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isTyping}
                ref={inputRef}
                rows={3}
              />
              <button type="submit" className={styles.submitBtn} disabled={!input.trim() || isTyping}>
                Envoyer
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
