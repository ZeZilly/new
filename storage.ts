import { type ContactMessage, type InsertContact, type User, type InsertUser, type Appointment, type InsertAppointment } from "@shared/schema";
import type { SessionData } from "express-session";
import createMemoryStore from "memorystore";
import session from "express-session";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  createContactMessage(message: InsertContact): Promise<ContactMessage>;
  createOrUpdateUser(user: Partial<InsertUser> & { googleId: string, accessToken?: string, refreshToken?: string }): Promise<User>;
  getUser(id: number): Promise<User | null>;
  getUserByGoogleId(googleId: string): Promise<User | null>;
  createAppointment(appointment: InsertAppointment & { userId: number, status: string }): Promise<Appointment>;
  sessionStore: session.Store;
}

export class MemStorage implements IStorage {
  private messages: Map<number, ContactMessage>;
  private users: Map<number, User>;
  private appointments: Map<number, Appointment>;
  private currentId: number;
  sessionStore: session.Store;

  constructor() {
    this.messages = new Map();
    this.users = new Map();
    this.appointments = new Map();
    this.currentId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // Prune expired entries every 24h
    });
  }

  async createContactMessage(message: InsertContact): Promise<ContactMessage> {
    const id = this.currentId++;
    const newMessage: ContactMessage = { id, ...message };
    this.messages.set(id, newMessage);
    return newMessage;
  }

  async createOrUpdateUser(userData: Partial<InsertUser> & { googleId: string }): Promise<User> {
    let user = await this.getUserByGoogleId(userData.googleId);

    if (!user) {
      const id = this.currentId++;
      user = {
        id,
        name: userData.name || '',
        email: userData.email || '',
        phone: userData.phone || '',
        googleId: userData.googleId,
        gender: userData.gender || null,
        age: userData.age || null,
        createdAt: new Date()
      };
      this.users.set(id, user);
    }

    return user;
  }

  async getUser(id: number): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async getUserByGoogleId(googleId: string): Promise<User | null> {
    return Array.from(this.users.values()).find(user => user.googleId === googleId) || null;
  }

  async createAppointment(appointment: InsertAppointment & { userId: number, status: string }): Promise<Appointment> {
    const id = this.currentId++;
    const newAppointment: Appointment = {
      id,
      userId: appointment.userId,
      serviceType: appointment.serviceType,
      appointmentDate: appointment.appointmentDate,
      status: appointment.status,
      createdAt: new Date()
    };
    this.appointments.set(id, newAppointment);
    return newAppointment;
  }
}

export const storage = new MemStorage();