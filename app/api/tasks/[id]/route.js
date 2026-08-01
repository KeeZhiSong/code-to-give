import { NextResponse } from "next/server";
import { updateTask, deleteTask, TaskError } from "../../../../lib/tasks.js";

export const dynamic = "force-dynamic";

export async function PATCH(request, { params }) {
  const { id } = await params;
  try {
    const task = await updateTask(id, await request.json());
    return NextResponse.json({ task });
  } catch (e) {
    const status = e instanceof TaskError ? 400 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

export async function DELETE(_request, { params }) {
  const { id } = await params;
  try {
    await deleteTask(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = e instanceof TaskError ? 400 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}
