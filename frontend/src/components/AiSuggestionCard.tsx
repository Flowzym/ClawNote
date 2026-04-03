import type { AiStructureTaskSuggestion, Category, Folder, Lane, Priority, Workspace } from '../types';

export type EditableSuggestion = AiStructureTaskSuggestion & { suggestionId: string };
type SuggestionPatch = Partial<Omit<EditableSuggestion, 'suggestionId'>>;

export type AiSuggestionValidation = {
  isValid: boolean;
  titleError: string | null;
  folderHint: string | null;
};

const suggestionLaneOptions: Array<{ id: Exclude<Lane, 'done'>; label: string }> = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'today', label: 'Heute' },
  { id: 'week', label: 'Diese Woche' },
  { id: 'later', label: 'Später' },
];

const suggestionPriorityOptions: Priority[] = ['niedrig', 'mittel', 'hoch', 'kritisch'];

type Props = {
  suggestion: EditableSuggestion;
  workspaces: Workspace[];
  folders: Folder[];
  categories: Category[];
  validation: AiSuggestionValidation;
  isApplying: boolean;
  onChange: (patch: SuggestionPatch) => void;
  onRemove: () => void;
  onApply: () => void;
};

export function AiSuggestionCard({ suggestion, workspaces, folders, categories, validation, isApplying, onChange, onRemove, onApply }: Props) {
  const suggestionFolders = folders.filter((folder) => folder.workspaceId === suggestion.workspaceIdSuggestion);

  return (
    <article className={`ai-suggestion-card ${!validation.isValid ? 'ai-suggestion-card--invalid' : ''}`}>
      <div className="ai-suggestion-card__header">
        <div className="ai-suggestion-card__meta">
          <span className="badge">Confidence: {Math.round(suggestion.confidence * 100)}%</span>
          {suggestion.tags.map((tag) => (
            <span className="badge" key={tag}>#{tag}</span>
          ))}
        </div>
        <div className="ai-suggestion-card__actions">
          <button className="ghost-button ghost-button--small" disabled={isApplying} onClick={onRemove} type="button">Entfernen</button>
          <button className="primary-button ghost-button--small" disabled={isApplying || !validation.isValid} onClick={onApply} type="button">Übernehmen</button>
        </div>
      </div>

      <div className="ai-suggestion-card__editor editor-grid">
        <label className="field field--full">
          <span>Titel</span>
          <input className={validation.titleError ? 'field__input--invalid' : undefined} type="text" value={suggestion.title} onChange={(event) => onChange({ title: event.target.value })} placeholder="Titel" />
          {validation.titleError && <small className="field-hint field-hint--error">{validation.titleError}</small>}
        </label>

        <label className="field">
          <span>Workspace</span>
          <select
            value={suggestion.workspaceIdSuggestion}
            onChange={(event) => {
              const workspaceId = event.target.value;
              const nextFolders = folders.filter((folder) => folder.workspaceId === workspaceId);
              const keepFolder = nextFolders.some((folder) => folder.id === suggestion.folderIdSuggestion);
              onChange({ workspaceIdSuggestion: workspaceId, folderIdSuggestion: keepFolder ? suggestion.folderIdSuggestion : null });
            }}
          >
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Ordner</span>
          <select value={suggestion.folderIdSuggestion ?? ''} onChange={(event) => onChange({ folderIdSuggestion: event.target.value || null })}>
            <option value="">Kein Ordner</option>
            {suggestionFolders.map((folder) => (
              <option key={folder.id} value={folder.id}>{folder.name}</option>
            ))}
          </select>
          {validation.folderHint && <small className="field-hint">{validation.folderHint}</small>}
        </label>

        <label className="field">
          <span>Kategorie</span>
          <select value={suggestion.categoryIdSuggestion ?? ''} onChange={(event) => onChange({ categoryIdSuggestion: event.target.value || null })}>
            <option value="">Keine Kategorie</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Priorität</span>
          <select value={suggestion.priority} onChange={(event) => onChange({ priority: event.target.value as Priority })}>
            {suggestionPriorityOptions.map((priority) => (
              <option key={priority} value={priority}>{priority}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Lane</span>
          <select value={suggestion.lane === 'done' ? 'inbox' : suggestion.lane} onChange={(event) => onChange({ lane: event.target.value as EditableSuggestion['lane'] })}>
            {suggestionLaneOptions.map((lane) => (
              <option key={lane.id} value={lane.id}>{lane.label}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Fälligkeit</span>
          <input type="date" value={suggestion.dueDate ?? ''} onChange={(event) => onChange({ dueDate: event.target.value || null })} />
        </label>

        <label className="field field--full">
          <span>Notizen</span>
          <textarea rows={3} value={suggestion.notes} onChange={(event) => onChange({ notes: event.target.value })} placeholder="Notizen" />
        </label>
      </div>

      <p className="ai-suggestion-card__hint">Erledigt bleibt checkbox-gesteuert. Vorschläge werden erst beim Übernehmen als normale Tasks gespeichert.</p>
    </article>
  );
}
