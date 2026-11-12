// Tarefas — Nay delegates to the assistant (with a deadline) and answers
// her questions. Shared implementation: shared/team-tasks.js.
import { renderShell } from '../shared/ui.js';
import { requireProfile } from '../shared/supabase-auth.js';
import { mountTasksPage } from '../shared/team-tasks.js';

const profile = await requireProfile('admin');
if (!profile) throw new Error('not authorized');
document.body.innerHTML = renderShell({ role: 'admin', active: 'tarefas.html', title: 'Tarefas' });
mountTasksPage(document.getElementById('app-content'), profile);
