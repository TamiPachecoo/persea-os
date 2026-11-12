// Tarefas — what Nay asked for, with deadlines, and questions back to her.
// Shared implementation: shared/team-tasks.js.
import { renderShell } from '../shared/ui.js';
import { requireProfile } from '../shared/supabase-auth.js';
import { mountTasksPage } from '../shared/team-tasks.js';

const profile = await requireProfile('assistant');
if (!profile) throw new Error('not authorized');
document.body.innerHTML = renderShell({ role: 'assistant', active: 'tarefas.html', title: 'Tarefas' });
mountTasksPage(document.getElementById('app-content'), profile);
