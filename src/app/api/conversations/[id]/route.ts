
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

// GET: Load one conversation with its messages and PDFs
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Find the conversation
    const conversationResult = await pool.query(
      `SELECT id, title, created_at
       FROM conversations
       WHERE id = $1`,
      [id]
    );

    if (conversationResult.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Conversation not found.",
        },
        { status: 404 }
      );
    }

    // 2. Load conversation messages
    const messagesResult = await pool.query(
      `SELECT id, role, content, created_at
       FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [id]
    );

    // 3. Load PDFs linked to this conversation
    const documentsResult = await pool.query(
      `SELECT
         d.id,
         d.filename,
         d.file_size,
         d.status
       FROM conversation_documents cd
       INNER JOIN documents d
         ON d.id = cd.document_id
       WHERE cd.conversation_id = $1
       ORDER BY d.filename ASC`,
      [id]
    );

    // 4. Return complete conversation
    return NextResponse.json({
      success: true,
      conversation: conversationResult.rows[0],
      messages: messagesResult.rows,
      documents: documentsResult.rows,
    });
  } catch (error) {
    console.error("Load conversation error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to load conversation.",
      },
      { status: 500 }
    );
  }
}

// DELETE: Delete a conversation and its related records
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const result = await pool.query(
      `DELETE FROM conversations
       WHERE id = $1
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Conversation not found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Conversation deleted successfully.",
    });
  } catch (error) {
    console.error("Delete conversation error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to delete conversation.",
      },
      { status: 500 }
    );
  }
}
