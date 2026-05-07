type ChatMessage = {
  role: "user" | "ai";
  content: string;
  stage?: number;
  stageTitle?: string;
};

type Advice = {
  content: string;
  score?: number;
  tags: string[];
  nextStep: string;
  stage: number;
  stageTitle: string;
};

type OpenAIOutputContent = {
  type?: string;
  text?: string;
};

type OpenAIOutputItem = {
  content?: OpenAIOutputContent[];
};

type OpenAIResponse = {
  output_text?: string;
  output?: OpenAIOutputItem[];
};

const interviewStages = [
  {
    title: "Idee",
    question: "Explique ton idee en une phrase simple: pour qui, quel probleme, quel resultat concret ?",
    reason: "Si l'idee ne tient pas en une phrase, elle sera difficile a vendre, expliquer et tester.",
  },
  {
    title: "Client",
    question: "Qui est ton client ideal exactement ? Donne un profil precis, pas juste une categorie large.",
    reason: "Une cible floue rend le produit, le prix et l'acquisition flous.",
  },
  {
    title: "Douleur",
    question: "Quelle douleur urgente il ressent aujourd'hui, et comment il la gere sans ton produit ?",
    reason: "Les gens paient pour une douleur forte, frequente ou couteuse, pas pour une idee sympa.",
  },
  {
    title: "Solution",
    question: "Quelle est ta solution concrete, et quelle partie serait vraiment indispensable en version 1 ?",
    reason: "Un MVP utile doit resoudre le coeur du probleme, pas empiler des fonctionnalites.",
  },
  {
    title: "Marche",
    question: "Quelle taille de marche vises-tu, meme approximativement, et sur quelle niche tu commences ?",
    reason: "Un bon marche donne de l'air; une bonne niche donne un point d'entree.",
  },
  {
    title: "Concurrence",
    question: "Qui sont les alternatives directes ou indirectes, et pourquoi un client changerait pour toi ?",
    reason: "Ton concurrent principal est souvent l'habitude actuelle, pas seulement une autre app.",
  },
  {
    title: "Innovation",
    question: "Qu'est-ce qui est vraiment nouveau dans ton approche, au-dela de mettre de l'IA dedans ?",
    reason: "L'innovation doit creer un avantage clair, pas seulement sonner moderne.",
  },
  {
    title: "Business model",
    question: "Qui paie, combien, a quelle frequence, et pourquoi le prix serait acceptable ?",
    reason: "Sans hypothese de prix, tu ne sais pas si tu construis un produit ou un hobby.",
  },
  {
    title: "Acquisition",
    question: "Quel canal peut te donner tes 20 premiers utilisateurs sans gros budget publicitaire ?",
    reason: "Si tu ne sais pas atteindre les premiers clients, le produit restera invisible.",
  },
  {
    title: "Execution",
    question: "Quelles sont les 3 prochaines actions concretes sur 14 jours pour prouver ou tuer l'idee ?",
    reason: "Le bon plan reduit l'incertitude vite, avec peu de code et peu d'argent.",
  },
];

const vaguePattern = /je sais pas|jsp|vague|aucune idee|peut-etre|pas sur|a voir|bof|comme tout le monde/i;

function getUserMessages(messages: ChatMessage[]) {
  return messages.filter((message) => message.role === "user" && message.content.trim());
}

function isVagueAnswer(answer: string) {
  return answer.trim().length < 42 || vaguePattern.test(answer);
}

function getProgress(messages: ChatMessage[]) {
  const userMessages = getUserMessages(messages);
  const latestAnswer = userMessages.at(-1)?.content ?? "";
  const substantiveAnswers = userMessages.filter((message) => !isVagueAnswer(message.content)).length;
  const latestIsVague = isVagueAnswer(latestAnswer);
  const stageIndex = Math.min(latestIsVague ? Math.max(0, substantiveAnswers - 1) : substantiveAnswers, interviewStages.length - 1);

  return {
    userMessages,
    latestAnswer,
    latestIsVague,
    stageIndex,
    substantiveAnswers,
    stage: interviewStages[stageIndex],
  };
}

function localAdvice(messages: ChatMessage[]): Advice {
  const { latestAnswer, latestIsVague, stageIndex, substantiveAnswers, stage } = getProgress(messages);
  const score = Math.min(92, 34 + substantiveAnswers * 6 + Math.min(20, Math.floor(latestAnswer.length / 22)));

  if (substantiveAnswers >= interviewStages.length && !latestIsVague) {
    return {
      score,
      stage: interviewStages.length,
      stageTitle: "Synthese",
      tags: ["synthese", "decision", "plan 14 jours"],
      content:
        "Tu as assez de matiere pour faire un premier tri serieux.\n\nPourquoi: on a couvert la cible, la douleur, le marche, la concurrence, le prix et l'acquisition. Avis tranche: ne construis pas toute l'app maintenant. Construis le test le plus court qui prouve qu'un client identifiable accepte de payer pour resoudre cette douleur.",
      nextStep:
        "Formalise une promesse, cree une demo ou page de precommande, puis fais 10 appels clients. Si personne ne s'engage concretement, change la cible, la douleur ou le prix.",
    };
  }

  return {
    score,
    stage: stageIndex + 1,
    stageTitle: stage.title,
    tags: [latestIsVague ? "reformulation" : "question suivante", "personnalise", stage.title.toLowerCase()],
    content: `${
      latestIsVague
        ? "Ta reponse est trop vague pour produire un avis utile. Je garde la meme etape et je la pose autrement."
        : "On avance, mais je ne vais pas te donner un faux feu vert. L'angle mort suivant peut tuer l'idee si tu l'ignores."
    }\n\nPourquoi: ${stage.reason}`,
    nextStep: stage.question,
  };
}

function extractOpenAIText(data: OpenAIResponse) {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  return data.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .filter((text): text is string => Boolean(text?.trim()))
    .join("\n")
    .trim();
}

function buildInstructions(messages: ChatMessage[]) {
  const { latestIsVague, stageIndex, substantiveAnswers, stage } = getProgress(messages);
  const isFinal = substantiveAnswers >= interviewStages.length && !latestIsVague;

  return `
Tu es "Avis Tranche", un conseiller startup franc, exigeant et utile.
Tu conduis un entretien en 10 etapes: ${interviewStages.map((item, index) => `${index + 1}. ${item.title}`).join(", ")}.

Regles:
- Reponds toujours en francais.
- Sois direct, critique et concret, sans etre insultant.
- Personnalise l'analyse avec les details donnes par l'utilisateur.
- N'avance qu'une seule question a la fois.
- Si la derniere reponse est vague, ne passe pas a l'etape suivante: reformule la question de facon plus simple.
- Explique toujours pourquoi la question compte pour le business.
- Ne donne pas seulement un score. Donne un raisonnement, les risques, et ce qu'il faut verifier.
- Termine par une question claire.

Etat actuel:
- Etape: ${stageIndex + 1}/10, ${stage.title}
- Derniere reponse vague: ${latestIsVague ? "oui" : "non"}
- Mode final: ${isFinal ? "oui" : "non"}
- Question a poser maintenant: ${stage.question}

Format attendu:
1 court paragraphe "Avis tranche".
1 court paragraphe "Pourquoi".
1 court paragraphe "Risque".
Puis une seule question precise pour continuer.
`.trim();
}

export async function POST(request: Request) {
  const body = (await request.json()) as { messages?: ChatMessage[] };
  const messages = body.messages?.filter((message) => message.content.trim()) ?? [];

  if (!messages.length) {
    return Response.json(localAdvice([]), { status: 400 });
  }

  const local = localAdvice(messages);

  if (!process.env.OPENAI_API_KEY) {
    return Response.json(local);
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-5.4",
      instructions: buildInstructions(messages),
      input: messages.map((message) => ({
        role: message.role === "ai" ? "assistant" : "user",
        content: message.content,
      })),
    }),
  });

  if (!response.ok) {
    return Response.json(local);
  }

  const data = (await response.json()) as OpenAIResponse;
  const content = extractOpenAIText(data);

  if (!content) {
    return Response.json(local);
  }

  return Response.json({
    ...local,
    content,
    tags: ["llm", "avis tranche", local.stageTitle.toLowerCase()],
  });
}
