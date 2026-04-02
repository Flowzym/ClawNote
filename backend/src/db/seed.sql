INSERT INTO workspaces (id, name, color, icon, is_default, sort_order, created_at, updated_at) VALUES
('ws_unsorted', 'Unsortiert', '#6b7280', 'inbox', 1, 0, datetime('now'), datetime('now')),
('ws_arbeit', 'Arbeit', '#2563eb', 'briefcase', 0, 1, datetime('now'), datetime('now')),
('ws_projekte', 'Projekte', '#7c3aed', 'folder-kanban', 0, 2, datetime('now'), datetime('now')),
('ws_privat', 'Privat', '#059669', 'home', 0, 3, datetime('now'), datetime('now'));

INSERT INTO folders (id, workspace_id, parent_folder_id, name, color, sort_order, created_at, updated_at) VALUES
('fld_ams', 'ws_arbeit', NULL, 'AMS', '#2563eb', 0, datetime('now'), datetime('now')),
('fld_beratung', 'ws_arbeit', NULL, 'Beratung', '#2563eb', 1, datetime('now'), datetime('now')),
('fld_berichte', 'ws_arbeit', NULL, 'Berichte', '#2563eb', 2, datetime('now'), datetime('now')),
('fld_seminare', 'ws_arbeit', NULL, 'Seminare', '#2563eb', 3, datetime('now'), datetime('now')),
('fld_organisation', 'ws_arbeit', NULL, 'Organisation', '#2563eb', 4, datetime('now'), datetime('now')),
('fld_openclaw', 'ws_projekte', NULL, 'OpenClaw', '#7c3aed', 0, datetime('now'), datetime('now')),
('fld_helferchat', 'ws_projekte', NULL, 'Helferchat', '#7c3aed', 1, datetime('now'), datetime('now')),
('fld_foerdernavigator', 'ws_projekte', NULL, 'Förder-Navigator', '#7c3aed', 2, datetime('now'), datetime('now')),
('fld_betterletter', 'ws_projekte', NULL, 'Better_Letter', '#7c3aed', 3, datetime('now'), datetime('now')),
('fld_haushalt', 'ws_privat', NULL, 'Haushalt', '#059669', 0, datetime('now'), datetime('now')),
('fld_gesundheit', 'ws_privat', NULL, 'Gesundheit', '#059669', 1, datetime('now'), datetime('now'));

INSERT INTO categories (id, name, color, icon, is_system, sort_order, created_at, updated_at) VALUES
('cat_kommunikation', 'Kommunikation', '#0ea5e9', 'message-square', 1, 0, datetime('now'), datetime('now')),
('cat_organisation', 'Organisation', '#64748b', 'list-todo', 1, 1, datetime('now'), datetime('now')),
('cat_schreiben', 'Schreiben', '#f59e0b', 'file-text', 1, 2, datetime('now'), datetime('now')),
('cat_recherche', 'Recherche', '#8b5cf6', 'search', 1, 3, datetime('now'), datetime('now')),
('cat_termin', 'Termin', '#ef4444', 'calendar', 1, 4, datetime('now'), datetime('now')),
('cat_idee', 'Idee', '#10b981', 'lightbulb', 1, 5, datetime('now'), datetime('now')),
('cat_warten', 'Warten auf', '#f97316', 'clock', 1, 6, datetime('now'), datetime('now')),
('cat_einkauf', 'Einkauf', '#22c55e', 'shopping-cart', 1, 7, datetime('now'), datetime('now')),
('cat_privat', 'Privat', '#14b8a6', 'home', 1, 8, datetime('now'), datetime('now')),
('cat_arbeit', 'Arbeit', '#2563eb', 'briefcase', 1, 9, datetime('now'), datetime('now'));
