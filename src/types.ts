// ── Domain types ──────────────────────────────────────────────────────────────

export type RecipeType = 'cocktail' | 'syrup' | 'bitter' | 'tincture' | 'shrub' | 'batch' | 'other';
export type IceType = 'none' | 'cubed' | 'large_cube' | 'crushed' | 'cracked' | 'sphere';
export type RecipeMethod = 'stirred' | 'shaken' | 'built' | 'blended' | 'thrown' | 'batch';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type Unit = 'oz' | 'ml' | 'dash' | 'barspoon' | 'tsp' | 'tbsp' | 'cup';
export type RecipeVisibility = 'private' | 'friends' | 'public';

export interface User {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  default_units: 'oz' | 'ml';
  created_at: number;
}

export interface Ingredient {
  id: string;
  recipe_id: string;
  name: string;
  amount: number | null;
  unit: string | null;
  referenced_recipe_id: string | null;
  order_index: number;
  // Joined at display time
  referencedRecipe?: Recipe | null;
}

export interface Step {
  id: string;
  recipe_id: string;
  description: string;
  order_index: number;
}

export interface RecipeImage {
  id: string;
  recipe_id: string;
  r2_key: string;
  is_primary: number;
  created_at: number;
}

export interface Recipe {
  id: string;
  user_id: string;
  name: string;
  type: RecipeType;
  glass_type: string | null;
  ice_type: IceType | null;
  method: RecipeMethod | null;
  garnish: string | null;
  notes: string | null;
  difficulty: Difficulty | null;
  tags: string[];
  version: number;
  is_public: number;
  visibility?: RecipeVisibility;
  want_to_make: number;
  placeholder_icon: number | null;
  template_id: string | null;
  source_recipe_id: string | null;
  servings: number;
  created_at: number;
  updated_at: number;
  // Joined
  ingredients?: Ingredient[];
  steps?: Step[];
  images?: RecipeImage[];
  primary_image?: string | null;
  // For discovered recipes
  display_name?: string;
  avatar_url?: string | null;
}

export interface RecipeVersion {
  id: string;
  recipe_id: string;
  version: number;
  changed_at: number;
}

export interface RecipeTemplate {
  id: string;
  name: string;
  description: string | null;
  base_type: string | null;
  canonical?: {
    glass_type?: string;
    ice_type?: string;
    method?: string;
    garnish?: string;
    difficulty?: string;
    ingredients?: { name: string; amount?: number; unit?: string }[];
    steps?: { description: string }[];
  } | null;
  /** Flat ingredient name list returned by the list endpoint for synonym search indicators. */
  ingredients?: string[];
  riff_count?: number;
  avg_rating?: number;
}

export interface FriendRequest {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: number;
  // Joined
  display_name?: string;
  avatar_url?: string | null;
  email?: string;
}

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  friend_user_id?: string;
  status: string;
  created_at: number;
  // Joined
  display_name?: string;
  avatar_url?: string | null;
  email?: string;
}

// ── Form input types ──────────────────────────────────────────────────────────

export interface RecipeFormValues {
  name: string;
  type: RecipeType;
  glass_type: string;
  ice_type: string;
  method: string;
  garnish: string;
  notes: string;
  difficulty: string;
  tags: string[];
  is_public: boolean;
  visibility: RecipeVisibility;
  want_to_make: boolean;
  placeholder_icon: number | null;
  template_id: string | null;
  source_recipe_id: string | null;
  servings: number;
  ingredients: { id: string; name: string; amount: string; unit: string; referenced_recipe_id: string | null }[];
  steps: { id: string; description: string }[];
}

// ── Utility label maps ────────────────────────────────────────────────────────

export const RECIPE_TYPES: { value: RecipeType; label: string }[] = [
  { value: 'cocktail',  label: 'Cocktail'  },
  { value: 'syrup',    label: 'Syrup'     },
  { value: 'bitter',   label: 'Bitter'    },
  { value: 'tincture', label: 'Tincture'  },
  { value: 'shrub',    label: 'Shrub'     },
  { value: 'batch',    label: 'Batch'     },
  { value: 'other',    label: 'Other'     },
];

export const ICE_TYPES: { value: string; label: string }[] = [
  { value: 'none',      label: 'No ice'      },
  { value: 'cubed',     label: 'Cubed'       },
  { value: 'large_cube', label: 'Large cube' },
  { value: 'crushed',   label: 'Crushed'     },
  { value: 'cracked',   label: 'Cracked'     },
  { value: 'sphere',    label: 'Sphere'      },
];

export const METHODS: { value: string; label: string }[] = [
  { value: 'stirred', label: 'Stirred'  },
  { value: 'shaken',  label: 'Shaken'   },
  { value: 'built',   label: 'Built'    },
  { value: 'blended', label: 'Blended'  },
  { value: 'thrown',  label: 'Thrown'   },
  { value: 'batch',   label: 'Batch'    },
];

export const DIFFICULTIES: { value: string; label: string }[] = [
  { value: 'easy',   label: 'Easy'   },
  { value: 'medium', label: 'Medium' },
  { value: 'hard',   label: 'Hard'   },
];

export const UNITS: { value: string; label: string }[] = [
  { value: 'oz',       label: 'oz'       },
  { value: 'ml',       label: 'ml'       },
  { value: 'dash',     label: 'dash'     },
  { value: 'barspoon', label: 'barspoon' },
  { value: 'tsp',      label: 'tsp'      },
  { value: 'tbsp',     label: 'tbsp'     },
  { value: 'cup',      label: 'cup'      },
];

export const GLASS_TYPES: { value: string; label: string }[] = [
  { value: 'coupe',          label: 'Coupe'          },
  { value: 'rocks',          label: 'Rocks / Old Fashioned' },
  { value: 'highball',       label: 'Highball'       },
  { value: 'martini',        label: 'Martini'        },
  { value: 'nick_and_nora',  label: 'Nick & Nora'    },
  { value: 'mule',           label: 'Mule / Copper'  },
  { value: 'champagne_flute', label: 'Champagne Flute' },
  { value: 'wine',           label: 'Wine'           },
  { value: 'julep_cup',      label: 'Julep Cup'      },
  { value: 'snifter',        label: 'Snifter'        },
  { value: 'tiki',           label: 'Tiki'           },
  { value: 'other',          label: 'Other'          },
];
