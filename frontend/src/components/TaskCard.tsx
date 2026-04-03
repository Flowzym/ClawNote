import type { Category, Folder, Task, Workspace } from '../types';
import { TaskEditor, type TaskEditDraft, formatTaskDateForInput } from './TaskEditor';

type Props = {
  task: Task;
  workspace?: Workspace;
  folder?: Folder;
  category?: Category;
  workspaces: Workspace[];
  folders: Folder[];
  categories: Category[];
  isEditing: boolean;
  isSaving: boolean;
  editDraft: TaskEditDraft | null;
  onToggle: (taskId: string) => void;
  onStartEdit: (task: Task) => void;
  onCancelEdit: () => void;
  onDraftChange: (nextDraft: TaskEditDraft) => void;
  onSave: (task: Task) => void;
  onDelete: (task: Task) => void;
};

export function TaskCard({
  task,
  workspace,
  folder,
  category,
  workspaces,
  folders,
  categories,
  isEditing,
  isSaving,
  editDraft,
  onToggle,
  onStartEdit,
  onCancelEdit,
  onDraftChange,
  onSave,
  onDelete,
}: Props) {
  return (
    <article className={`task-card ${isEditing ? 'task-card--editing' : ''}`}>
      <div className="task-card-header">
        <label className="task-check">
          <input
            checked={task.status === 'done'}
            onChange={() => onToggle(task.id)}
            type="checkbox"
          />
        </label>

        <button
          type="button"
          className="task-summary-button"
          onClick={() => (isEditing ? onCancelEdit() : onStartEdit(task))}
        >
          <div>
            <strong className={task.status === 'done' ? 'task-title task-title--done' : 'task-title'}>
              {task.title}
            </strong>

            {task.notes && <p className="task-notes">{task.notes}</p>}

            <div className="meta-row">
              {workspace && <span className="badge badge--workspace">{workspace.name}</span>}
              {folder && <span className="badge">{folder.name}</span>}
              {category && <span className="badge">{category.name}</span>}
              <span className={`badge badge--priority-${task.priority}`}>{task.priority}</span>
              <span className="badge">{task.lane}</span>
              {task.dueDate && <span className="badge">fällig {formatTaskDateForInput(task.dueDate)}</span>}
            </div>
          </div>
        </button>

        <div className="task-actions">
          <button
            type="button"
            className="ghost-button task-action-button"
            onClick={() => (isEditing ? onCancelEdit() : onStartEdit(task))}
          >
            {isEditing ? 'Schließen' : 'Bearbeiten'}
          </button>

          <button
            type="button"
            className="ghost-button task-action-button task-action-button--danger"
            onClick={() => onDelete(task)}
          >
            Löschen
          </button>
        </div>
      </div>

      {isEditing && editDraft && (
        <TaskEditor
          task={task}
          draft={editDraft}
          workspaces={workspaces}
          folders={folders}
          categories={categories}
          isSaving={isSaving}
          onChange={onDraftChange}
          onCancel={onCancelEdit}
          onSave={() => onSave(task)}
        />
      )}
    </article>
  );
}
