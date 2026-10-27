import { ChefHat } from 'lucide-react';
import { recipeHue } from '../lib/utils';

export function RecipeArt({
  id,
  title,
  image,
  className,
}: {
  id: string;
  title: string;
  image?: string;
  className?: string;
}) {
  const hue = recipeHue(id);
  const initial = title.trim().charAt(0).toUpperCase() || 'M';

  return (
    <div
      className={`recipe-art${className ? ` ${className}` : ''}`}
      style={{
        ['--hue' as string]: String(hue),
      }}
      aria-hidden="true"
    >
      {image ? (
        <img src={image} alt="" loading="lazy" referrerPolicy="no-referrer" />
      ) : (
        <>
          <span className="recipe-art__initial">{initial}</span>
          <ChefHat className="recipe-art__icon" size={22} strokeWidth={1.5} />
        </>
      )}
    </div>
  );
}
