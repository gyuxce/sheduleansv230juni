export type ClassStatus = "available" | "pending_confirmation" | "booked" | "cancelled" | "completed";

export type CalendarClass = {
  id: string;
  sensei_id: string;
  student_id: string | null;
  starts_at: string;
  ends_at: string;
  level: string | null;
  status: ClassStatus;
  notes: string | null;
  meeting_url: string | null;
  version: number;
};
