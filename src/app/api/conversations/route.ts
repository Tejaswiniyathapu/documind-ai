
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

// GET: Load conversation history
export async function GET() {
  try {
    const result = await pool.query(
      `SELECT
         id,
         title,
         created_at
       FROM conversations
       ORDER BY created_at DESC`
    );

    return NextResponse.json({
      success: true,
      conversations: result.rows,
    });
  } catch (error) {
    console.error("Load conversations error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load conversations.",
      },
      { status: 500 }
    );
  }
}

// POST: Create a new conversation
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const title =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim().slice(0, 255)
        : "New conversation";

    const result = await pool.query(
      `INSERT INTO conversations (title)
       VALUES ($1)
       RETURNING id, title, created_at`,
      [title]
    );

    return NextResponse.json({
      success: true,
      conversation: result.rows[0],
    });
  } catch (error) {
    console.error("Create conversation error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to create conversation.",
      },
      { status: 500 }
    );
  }
}
