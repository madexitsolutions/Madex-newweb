import { z } from "zod";
import { services } from "@/content/services";

export const serviceOptions = [...services.map((s) => s.name), "Website-Wartung / Paket", "Kostenlose Analyse", "Andere Anfrage"];
export const timeSlots = ["Vormittag (08–12 Uhr)", "Nachmittag (13–17 Uhr)", "Abend (nach Absprache)", "Egal"];

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Bitte geben Sie Ihren Namen ein.").max(120),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  email: z.string().trim().email("Bitte geben Sie eine gültige E-Mail-Adresse ein.").max(200),
  phone: z
    .string()
    .trim()
    .max(40)
    .regex(/^[+()\d\s/-]*$/, "Bitte geben Sie eine gültige Telefonnummer ein.")
    .optional()
    .or(z.literal("")),
  service: z.string().trim().max(120).optional().or(z.literal("")),
  website: z.string().trim().max(200).optional().or(z.literal("")),
  message: z.string().trim().min(10, "Bitte beschreiben Sie Ihr Anliegen (mind. 10 Zeichen).").max(5000),
  date: z.string().trim().max(20).optional().or(z.literal("")),
  slot: z.string().trim().max(60).optional().or(z.literal("")),
  consent: z.literal(true, { errorMap: () => ({ message: "Bitte stimmen Sie der Datenverarbeitung zu." }) }),
  // honeypot – stays empty for people; a neutral name so browser autofill leaves it alone
  hp: z.string().max(500).optional().or(z.literal("")),
  source: z.string().max(80).optional(),
});

export type ContactInput = z.infer<typeof contactSchema>;
