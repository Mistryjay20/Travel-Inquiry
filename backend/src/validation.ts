import { z } from 'zod';

// Phone regex allows international format (+91...), spaces, dashes, standard 10-15 digits
const phoneRegex = /^[+]?[\d\s\-()]{7,20}$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const loginSchema = z.object({
  email: z.string().email('Valid email address required'),
  password: z.string().min(1, 'Password is required'),
});

export const agentSchema = z.object({
  name: z.string().trim().min(2, 'Agent name must be at least 2 characters'),
  phone: z.string().trim().regex(phoneRegex, 'Invalid phone number format (min 7 digits)'),
  email: z.string().trim().email('Valid email address required'),
  active: z.boolean().default(true),
});

export const agentUpdateSchema = agentSchema.partial();

export const inquiryStopSchema = z.object({
  place: z.string().trim().min(1, 'Place name is required'),
  nights: z.coerce.number().int().min(1, 'Nights must be at least 1'),
});

export const inquiryCreateSchema = z.object({
  type: z.enum(['package', 'ticket']),
  tripType: z.enum(['single', 'return']).optional(),
  clientName: z.string().trim().min(2, 'Client name must be at least 2 characters'),
  clientPhone: z.string().trim().regex(phoneRegex, 'Client phone must be at least 7 digits'),
  destination: z.string().trim().min(2, 'Destination must be at least 2 characters'),
  pickup: z.string().trim().min(2, 'Pickup point is required'),
  drop: z.string().trim().min(2, 'Drop point is required'),
  dateMode: z.enum(['fixed', 'anytime']),
  startDate: z.string().regex(dateRegex, 'Start date must be in YYYY-MM-DD format'),
  endDate: z.string().regex(dateRegex, 'End date must be in YYYY-MM-DD format'),
  returnDate: z.string().regex(dateRegex, 'Return date must be in YYYY-MM-DD format').optional().or(z.literal('')),
  adults: z.coerce.number().int().min(1, 'At least 1 adult passenger required'),
  children: z.coerce.number().int().min(0).default(0),
  travelClass: z.enum(['Economy', 'Premium Economy', 'Business']).optional().or(z.literal('')),
  airlinePref: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  stops: z.array(inquiryStopSchema).optional().default([]),
  agentIds: z.array(z.string()).min(1, 'Please select at least one agent to dispatch'),
});

export const inquiryStatusSchema = z.object({
  status: z.enum(['inquiry', 'confirmed', 'cancelled']),
});

export const ledgerCreateSchema = z.object({
  clientName: z.string().trim().min(2, 'Client name must be at least 2 characters'),
  amountReceived: z.coerce.number().positive('Amount received must be greater than zero'),
  date: z.string().regex(dateRegex, 'Date must be in YYYY-MM-DD format'),
  note: z.string().optional().default(''),
  inquiryId: z.string().optional().nullable(),
});

export const ledgerUpdateSchema = z.object({
  clientName: z.string().trim().min(2).optional(),
  amountReceived: z.coerce.number().positive().optional(),
  date: z.string().regex(dateRegex).optional(),
  note: z.string().optional(),
  inquiryId: z.string().optional().nullable(),
});

export const disbursementCreateSchema = z.object({
  agentName: z.string().trim().min(2, 'Agent name is required'),
  agentId: z.string().optional(),
  amount: z.coerce.number().positive('Sent amount must be greater than zero'),
  date: z.string().regex(dateRegex).optional(),
  note: z.string().optional().default(''),
});

export const disbursementUpdateSchema = z.object({
  agentName: z.string().trim().min(2).optional(),
  agentId: z.string().optional(),
  amount: z.coerce.number().positive().optional(),
  date: z.string().regex(dateRegex).optional(),
  note: z.string().optional(),
});

export const configUpdateSchema = z.object({
  resendApiKey: z.string().optional(),
  resendFromEmail: z.string().email().optional(),
});
