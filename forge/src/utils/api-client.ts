import { fetch } from '@forge/api';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const API_KEY = process.env.API_KEY || '';

interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

export async function backendGet<T>(path: string): Promise<ApiResponse<T>> {
  try {
    const url = `${BACKEND_URL}/api${path}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY ? { 'X-API-Key': API_KEY } : {}),
      },
    });

    if (!response.ok) {
      return { data: null, error: `API returned ${response.status}` };
    }

    const data = (await response.json()) as T;
    return { data, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { data: null, error: message };
  }
}
