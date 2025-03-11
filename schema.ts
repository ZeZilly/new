import { pgTable, text, serial, varchar, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  phone: varchar("phone", { length: 20 }),
  googleId: varchar("google_id", { length: 255 }).unique(),
  gender: varchar("gender", { length: 20 }),
  age: varchar("age", { length: 3 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").references(() => users.id),
  serviceType: varchar("service_type", { length: 100 }).notNull(),
  appointmentDate: timestamp("appointment_date").notNull(),
  status: varchar("status", { length: 20 }).notNull().default('pending'),
  createdAt: timestamp("created_at").defaultNow(),
});

export const contactMessages = pgTable("contact_messages", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  message: text("message").notNull(),
});

export const insertUserSchema = createInsertSchema(users)
  .pick({
    name: true,
    email: true,
    phone: true,
    gender: true,
    age: true,
  })
  .extend({
    email: z.string().email("Geçerli bir e-posta adresi giriniz"),
    phone: z.string().min(10, "Telefon numarası en az 10 karakter olmalıdır"),
  });

export const insertAppointmentSchema = createInsertSchema(appointments)
  .pick({
    serviceType: true,
    appointmentDate: true,
  });

export const insertContactSchema = createInsertSchema(contactMessages)
  .pick({
    name: true,
    email: true,
    phone: true,
    message: true,
  })
  .extend({
    email: z.string().email("Geçerli bir e-posta adresi giriniz"),
    phone: z.string().min(10, "Telefon numarası en az 10 karakter olmalıdır"),
    message: z.string().min(10, "Mesaj en az 10 karakter olmalıdır"),
  });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type User = typeof users.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type ContactMessage = typeof contactMessages.$inferSelect;