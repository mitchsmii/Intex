// Static templates for the four clinical instruments. Each template defines
// the question text the social worker reads aloud and the response options
// the resident chooses from.

export interface ItemOption {
  value: number
  label: string
}

export interface InstrumentTemplate {
  id: 'PCL5' | 'BDI' | 'BAI' | 'SUICIDE_RISK'
  name: string
  fullName: string
  description: string
  timeframe: string
  itemCount: number
  // For sum-based instruments (BDI, BAI, PCL-5)
  items?: Array<{ index: number; question: string; options: ItemOption[] }>
}

// ---------- BDI ----------
const BDI_RESPONSES_PER_ITEM: string[][] = [
  // 1. Sadness
  [
    'I do not feel sad.',
    'I feel sad.',
    "I am sad all the time and I can't snap out of it.",
    "I am so sad and unhappy that I can't stand it.",
  ],
  // 2. Discouraged about future
  [
    'I am not particularly discouraged about the future.',
    'I feel discouraged about the future.',
    'I feel I have nothing to look forward to.',
    'I feel the future is hopeless and that things cannot improve.',
  ],
  // 3. Failure
  [
    'I do not feel like a failure.',
    'I feel I have failed more than the average person.',
    'As I look back on my life, all I can see is a lot of failures.',
    'I feel I am a complete failure as a person.',
  ],
  // 4. Satisfaction
  [
    'I get as much satisfaction out of things as I used to.',
    "I don't enjoy things the way I used to.",
    "I don't get real satisfaction out of anything anymore.",
    'I am dissatisfied or bored with everything.',
  ],
  // 5. Guilt
  [
    "I don't feel particularly guilty.",
    'I feel guilty a good part of the time.',
    'I feel quite guilty most of the time.',
    'I feel guilty all of the time.',
  ],
  // 6. Punishment
  [
    "I don't feel I am being punished.",
    'I feel I may be punished.',
    'I expect to be punished.',
    'I feel I am being punished.',
  ],
  // 7. Disappointment in self
  [
    "I don't feel disappointed in myself.",
    'I am disappointed in myself.',
    'I am disgusted with myself.',
    'I hate myself.',
  ],
  // 8. Self-blame
  [
    "I don't feel I am any worse than anybody else.",
    'I am critical of myself for my weaknesses or mistakes.',
    'I blame myself all the time for my faults.',
    'I blame myself for everything bad that happens.',
  ],
  // 9. SUICIDAL IDEATION
  [
    "I don't have any thoughts of killing myself.",
    'I have thoughts of killing myself, but I would not carry them out.',
    'I would like to kill myself.',
    'I would kill myself if I had the chance.',
  ],
  // 10. Crying
  [
    "I don't cry any more than usual.",
    'I cry more now than I used to.',
    'I cry all the time now.',
    "I used to be able to cry, but now I can't cry even though I want to.",
  ],
  // 11. Irritation
  [
    'I am no more irritated by things than I ever was.',
    'I am slightly more irritated now than usual.',
    'I am quite annoyed or irritated a good deal of the time.',
    'I feel irritated all the time.',
  ],
  // 12. Interest in others
  [
    'I have not lost interest in other people.',
    'I am less interested in other people than I used to be.',
    'I have lost most of my interest in other people.',
    'I have lost all of my interest in other people.',
  ],
  // 13. Decisions
  [
    'I make decisions about as well as I ever could.',
    'I put off making decisions more than I used to.',
    'I have greater difficulty in making decisions more than I used to.',
    "I can't make decisions at all anymore.",
  ],
  // 14. Appearance
  [
    "I don't feel that I look any worse than I used to.",
    'I am worried that I am looking old or unattractive.',
    'I feel there are permanent changes in my appearance that make me look unattractive.',
    'I believe that I look ugly.',
  ],
  // 15. Work
  [
    'I can work about as well as before.',
    'It takes an extra effort to get started at doing something.',
    'I have to push myself very hard to do anything.',
    "I can't do any work at all.",
  ],
  // 16. Sleep
  [
    'I can sleep as well as usual.',
    "I don't sleep as well as I used to.",
    'I wake up 1–2 hours earlier than usual and find it hard to get back to sleep.',
    'I wake up several hours earlier than I used to and cannot get back to sleep.',
  ],
  // 17. Tiredness
  [
    "I don't get more tired than usual.",
    'I get tired more easily than I used to.',
    'I get tired from doing almost anything.',
    'I am too tired to do anything.',
  ],
  // 18. Appetite
  [
    'My appetite is no worse than usual.',
    'My appetite is not as good as it used to be.',
    'My appetite is much worse now.',
    'I have no appetite at all anymore.',
  ],
  // 19. Weight
  [
    "I haven't lost much weight, if any, lately.",
    'I have lost more than five pounds.',
    'I have lost more than ten pounds.',
    'I have lost more than fifteen pounds.',
  ],
  // 20. Health worry
  [
    'I am no more worried about my health than usual.',
    'I am worried about physical problems like aches, pains, upset stomach, or constipation.',
    "I am very worried about physical problems and it's hard to think of much else.",
    'I am so worried about my physical problems that I cannot think of anything else.',
  ],
  // 21. Sex
  [
    'I have not noticed any recent change in my interest in sex.',
    'I am less interested in sex than I used to be.',
    'I have almost no interest in sex.',
    'I have lost interest in sex completely.',
  ],
]

const BDI_TOPICS = [
  'Sadness', 'Discouragement about future', 'Failure', 'Satisfaction', 'Guilt',
  'Punishment', 'Disappointment in self', 'Self-blame', 'Suicidal ideation', 'Crying',
  'Irritation', 'Interest in others', 'Decision-making', 'Appearance', 'Work',
  'Sleep', 'Tiredness', 'Appetite', 'Weight loss', 'Health worry', 'Sex',
]

export const BDI_TEMPLATE: InstrumentTemplate = {
  id: 'BDI',
  name: 'BDI',
  fullName: 'Beck Depression Inventory',
  description: '21-item screen for depression severity. Read each option to the resident and mark the one that best describes how she has felt over the past 2 weeks.',
  timeframe: 'past 2 weeks',
  itemCount: 21,
  items: BDI_RESPONSES_PER_ITEM.map((options, i) => ({
    index: i + 1,
    question: `${i + 1}. ${BDI_TOPICS[i]}`,
    options: options.map((label, value) => ({ value, label })),
  })),
}

// ---------- BAI ----------
const BAI_SYMPTOMS = [
  'Numbness or tingling',
  'Feeling hot',
  'Wobbliness in legs',
  'Unable to relax',
  'Fear of worst happening',
  'Dizzy or lightheaded',
  'Heart pounding / racing',
  'Unsteady',
  'Terrified or afraid',
  'Nervous',
  'Feeling of choking',
  'Hands trembling',
  'Shaky / unsteady',
  'Fear of losing control',
  'Difficulty in breathing',
  'Fear of dying',
  'Scared',
  'Indigestion',
  'Faint / lightheaded',
  'Face flushed',
  'Hot / cold sweats',
]

const BAI_OPTIONS: ItemOption[] = [
  { value: 0, label: 'Not at all' },
  { value: 1, label: "Mildly, but it didn't bother me much" },
  { value: 2, label: "Moderately — it wasn't pleasant at times" },
  { value: 3, label: 'Severely — it bothered me a lot' },
]

export const BAI_TEMPLATE: InstrumentTemplate = {
  id: 'BAI',
  name: 'BAI',
  fullName: 'Beck Anxiety Inventory',
  description: 'Common symptoms of anxiety. Ask the resident how much each symptom has bothered her in the past month.',
  timeframe: 'past month',
  itemCount: 21,
  items: BAI_SYMPTOMS.map((symptom, i) => ({
    index: i + 1,
    question: `${i + 1}. ${symptom}`,
    options: BAI_OPTIONS,
  })),
}

// ---------- PCL-5 ----------
const PCL5_QUESTIONS = [
  'Repeated, disturbing, and unwanted memories of the stressful experience?',
  'Repeated, disturbing dreams of the stressful experience?',
  'Suddenly feeling or acting as if the stressful experience were actually happening again (as if you were actually back there reliving it)?',
  'Feeling very upset when something reminded you of the stressful experience?',
  'Having strong physical reactions when something reminded you of the stressful experience (for example, heart pounding, trouble breathing, sweating)?',
  'Avoiding memories, thoughts, or feelings related to the stressful experience?',
  'Avoiding external reminders of the stressful experience (for example, people, places, conversations, activities, objects, or situations)?',
  'Trouble remembering important parts of the stressful experience?',
  'Having strong negative beliefs about yourself, other people, or the world (for example, having thoughts such as: I am bad, there is something seriously wrong with me, no one can be trusted, the world is completely dangerous)?',
  'Blaming yourself or someone else for the stressful experience or what happened after it?',
  'Having strong negative feelings such as fear, horror, anger, guilt, or shame?',
  'Loss of interest in activities that you used to enjoy?',
  'Feeling distant or cut off from other people?',
  'Trouble experiencing positive feelings (for example, being unable to feel happiness or have loving feelings for people close to you)?',
  'Irritable behavior, angry outbursts, or acting aggressively?',
  'Taking too many risks or doing things that could cause you harm?',
  'Being "superalert" or watchful or on guard?',
  'Feeling jumpy or easily startled?',
  'Having difficulty concentrating?',
  'Trouble falling or staying asleep?',
]

const PCL5_OPTIONS: ItemOption[] = [
  { value: 0, label: 'Not at all' },
  { value: 1, label: 'A little bit' },
  { value: 2, label: 'Moderately' },
  { value: 3, label: 'Quite a bit' },
  { value: 4, label: 'Extremely' },
]

export const PCL5_TEMPLATE: InstrumentTemplate = {
  id: 'PCL5',
  name: 'PCL-5',
  fullName: 'PTSD Checklist for DSM-5',
  description: 'Ask the resident to keep her worst event in mind. For each item, ask how much she was bothered by that problem in the past month.',
  timeframe: 'past month',
  itemCount: 20,
  items: PCL5_QUESTIONS.map((question, i) => ({
    index: i + 1,
    question: `${i + 1}. ${question}`,
    options: PCL5_OPTIONS,
  })),
}

// ---------- Suicide Risk (sectioned, special-cased in form) ----------
export const SUICIDE_RISK_TEMPLATE: InstrumentTemplate = {
  id: 'SUICIDE_RISK',
  name: 'Suicide Risk',
  fullName: 'Clinical Suicide Risk Assessment',
  description: 'Six-section clinical screener. Tick the box for each section that applies. Ticks are summed to determine overall risk level.',
  timeframe: 'current',
  itemCount: 6,
}

export const TEMPLATES: Record<InstrumentTemplate['id'], InstrumentTemplate> = {
  PCL5: PCL5_TEMPLATE,
  BDI: BDI_TEMPLATE,
  BAI: BAI_TEMPLATE,
  SUICIDE_RISK: SUICIDE_RISK_TEMPLATE,
}
