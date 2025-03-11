import { OAuth2Client } from "google-auth-library";
import { calendar } from "@googleapis/calendar";
import { type Express } from "express";
import session from "express-session";
import { storage } from "./storage";

declare module 'express-session' {
  interface SessionData {
    userId: number;
    tokens?: {
      access_token: string;
      refresh_token: string;
    };
  }
}

// Initialize OAuth2 client
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "https://shining-beauty.repl.co/auth/google/callback"
);

// Initialize Google Calendar
const calendarClient = calendar({
  version: 'v3',
  auth: oauth2Client
});

export function setupAuth(app: Express) {
  app.use(
    session({
      secret: process.env.SESSION_SECRET!,
      resave: false,
      saveUninitialized: false,
      store: storage.sessionStore,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      }
    })
  );

  // Google OAuth routes
  app.get("/auth/google", (req, res) => {
    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: [
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/calendar"
      ]
    });
    res.redirect(url);
  });

  app.get("/auth/google/callback", async (req, res) => {
    try {
      const { code } = req.query;
      if (typeof code !== 'string') {
        throw new Error('Invalid authorization code');
      }

      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      // Store tokens in session
      req.session.tokens = {
        access_token: tokens.access_token!,
        refresh_token: tokens.refresh_token!
      };

      // Get user info
      const tokenInfo = await oauth2Client.getTokenInfo(tokens.access_token!);

      // Create or update user
      const user = await storage.createOrUpdateUser({
        email: tokenInfo.email!,
        googleId: tokenInfo.sub!,
        name: '', // Will be updated later with profile info
        phone: '',
        gender: null,
        age: null
      });

      // Set user session
      req.session.userId = user.id;
      res.redirect("/");
    } catch (error) {
      console.error("Auth error:", error);
      res.redirect("/login?error=auth_failed");
    }
  });

  // Calendar API endpoints
  app.get("/api/calendar/available-slots", async (req, res) => {
    try {
      if (!req.session.tokens) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Set credentials for this request
      oauth2Client.setCredentials({
        access_token: req.session.tokens.access_token,
        refresh_token: req.session.tokens.refresh_token
      });

      const timeMin = new Date();
      const timeMax = new Date();
      timeMax.setDate(timeMax.getDate() + 14); // Next 14 days

      // Get busy slots
      const response = await calendarClient.events.list({
        calendarId: 'primary',
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      // Generate available slots
      const workingHours = {
        start: 9, // 09:00
        end: 20, // 20:00
      };

      const availableSlots = [];
      const currentDate = new Date(timeMin);

      while (currentDate <= timeMax) {
        // Skip if it's outside working hours
        const hour = currentDate.getHours();
        if (hour >= workingHours.start && hour < workingHours.end) {
          const slot = currentDate.toLocaleTimeString('tr-TR', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
          });
          availableSlots.push(slot);
        }

        // Move to next hour
        currentDate.setHours(currentDate.getHours() + 1);
      }

      res.json(availableSlots);
    } catch (error) {
      console.error("Calendar error:", error);
      res.status(500).json({ error: "Failed to fetch calendar slots" });
    }
  });

  // Book appointment endpoint
  app.post("/api/appointments", async (req, res) => {
    if (!req.session.userId || !req.session.tokens) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { date, service } = req.body;

      // Set credentials for this request
      oauth2Client.setCredentials({
        access_token: req.session.tokens.access_token,
        refresh_token: req.session.tokens.refresh_token
      });

      // Create calendar event
      const event = await calendarClient.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary: `Beauty Appointment - ${service}`,
          start: {
            dateTime: date,
          },
          end: {
            dateTime: new Date(new Date(date).getTime() + 60 * 60 * 1000).toISOString(), // 1 hour duration
          },
        },
      });

      // Store appointment in database
      const appointment = await storage.createAppointment({
        userId: req.session.userId,
        serviceType: service,
        appointmentDate: new Date(date),
        status: 'confirmed'
      });

      res.json({ appointment, calendarEvent: event.data });
    } catch (error) {
      console.error("Appointment creation error:", error);
      res.status(500).json({ error: "Failed to create appointment" });
    }
  });
}