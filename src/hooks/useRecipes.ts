import { useState, useCallback } from 'react';
import type { Recipe, RecipeFormValues } from '../types';

export function useRecipes() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listRecipes = useCallback(async (params?: {
    type?: string;
    difficulty?: string;
    tag?: string;
    q?: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (params?.type) qs.set('type', params.type);
      if (params?.difficulty) qs.set('difficulty', params.difficulty);
      if (params?.tag) qs.set('tag', params.tag);
      if (params?.q) qs.set('q', params.q);
      const res = await fetch(`/api/recipes?${qs}`);
      if (!res.ok) throw new Error('Failed to load recipes');
      const data = await res.json() as { recipes: Recipe[] };
      return data.recipes;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setError(msg);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const getRecipe = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/recipes/${id}`);
      if (!res.ok) throw new Error('Recipe not found');
      const data = await res.json() as { recipe: Recipe };
      return data.recipe;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const saveRecipe = useCallback(async (
    values: RecipeFormValues,
    existingId?: string,
  ): Promise<string | null> => {
    setLoading(true);
    setError(null);
    try {
      const body = {
        ...values,
        ingredients: values.ingredients.map((ing) => ({
          name: ing.name,
          amount: ing.amount !== '' ? parseFloat(ing.amount) : null,
          unit: ing.unit || null,
        })),
        steps: values.steps.map((s) => ({ description: s.description })),
      };

      const url = existingId ? `/api/recipes/${existingId}` : '/api/recipes';
      const method = existingId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? 'Failed to save recipe');
      }

      const data = await res.json() as { id?: string; ok?: boolean };
      return existingId ?? data.id ?? null;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteRecipe = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/recipes/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete recipe');
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, listRecipes, getRecipe, saveRecipe, deleteRecipe };
}
