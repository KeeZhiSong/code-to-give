import { NextResponse } from "next/server";
import { listTasks, createTask, TaskError } from "../../../../../lib/tasks.js";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const { id } = await params;
  try {
    const tasks = await listTasks(id);
    return NextResponse.json({ tasks });
  } catch (e) {
    const status = e instanceof TaskError ? 400 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}

export async function POST(request, { params }) {
  const { id } = await params;
  try {
    const task = await createTask(id, await request.json());
    return NextResponse.json({ task }, { status: 201 });
  } catch (e) {
    const status = e instanceof TaskError ? 400 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}
