import { cookies } from "next/headers";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { authenticate } from "@/lib/users";
import { loginSchema } from "@/lib/validation";
import { fail, handle, ok, fromZodError } from "@/lib/api";
import { ZodError } from "zod";

export async function POST(request: Request) {
  return handle(async () => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail("Request body must be JSON", 400);
    }

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) return fromZodError(parsed.error);

    const { email, password } = parsed.data;
    const user = await authenticate(email, password);

    // Deliberately vague: do not reveal whether the email exists.
    if (!user) return fail("Invalid email or password", 401);

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    const store = await cookies();
    store.set(SESSION_COOKIE.name, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_COOKIE.maxAge,
    });

    return ok({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        studentId: user.student?.id ?? null,
      },
    });
  });
}