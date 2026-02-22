import { v4 as uuidv4 } from 'uuid';
import { getGlobalDb } from '../database';
import type { Project, ProjectCreateInput } from '../../../shared/types';

export class ProjectRepository {
  list(): Project[] {
    const db = getGlobalDb();
    return db.prepare('SELECT * FROM projects ORDER BY last_opened DESC').all() as Project[];
  }

  getById(id: string): Project | undefined {
    const db = getGlobalDb();
    return db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project | undefined;
  }

  create(input: ProjectCreateInput): Project {
    const db = getGlobalDb();
    const now = new Date().toISOString();
    const id = uuidv4();
    const project: Project = {
      id,
      name: input.name,
      path: input.path,
      github_url: input.github_url || null,
      default_agent: 'claude',
      last_opened: now,
      created_at: now,
    };
    db.prepare(
      'INSERT INTO projects (id, name, path, github_url, default_agent, last_opened, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(project.id, project.name, project.path, project.github_url, project.default_agent, project.last_opened, project.created_at);
    return project;
  }

  updateLastOpened(id: string): void {
    const db = getGlobalDb();
    db.prepare('UPDATE projects SET last_opened = ? WHERE id = ?').run(new Date().toISOString(), id);
  }

  delete(id: string): void {
    const db = getGlobalDb();
    db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  }
}
