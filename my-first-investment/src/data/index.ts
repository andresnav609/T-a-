// Punto único de acceso al repositorio. En Fase 2, aquí se decidirá entre
// LocalRepository y SupabaseRepository (según sesión activa) sin tocar la UI.

import type { Repository } from './repository';
import { LocalRepository } from './localRepository';

let instance: Repository | null = null;

export function getRepository(): Repository {
  if (!instance) instance = new LocalRepository();
  return instance;
}

export type { Repository, BackupData } from './repository';
