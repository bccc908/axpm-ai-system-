export type Locale = "en" | "zh";

type NestedMessages = { [key: string]: string | NestedMessages };

export type TranslationDict = NestedMessages;
