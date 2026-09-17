import { ArrowDown, ArrowUp } from "lucide-react";

export type SortableCategory = { id: string; name: string; sortKey: string };

export default function CategoryOrder({
  categories,
  disabled,
  onChange,
}: {
  categories: SortableCategory[];
  disabled: boolean;
  onChange: (order: string[]) => void;
}) {
  function move(index: number, direction: number) {
    const order = categories.map((category) => category.sortKey);
    const next = index + direction;
    if (disabled || next < 0 || next >= order.length) return;
    [order[index], order[next]] = [order[next], order[index]];
    onChange(order);
  }
  return (
    <fieldset className="category-order" disabled={disabled}>
      <legend>分类排序</legend>
      <p>“全部”固定在首位</p>
      <ol aria-label="分类顺序">
        {categories.map((category, index) => (
          <li key={category.id}>
            <span title={category.name}>{category.name}</span>
            <button
              className="icon-button"
              aria-label={`上移分类 ${category.name}`}
              disabled={index === 0}
              onClick={() => move(index, -1)}
            >
              <ArrowUp size={16} />
            </button>
            <button
              className="icon-button"
              aria-label={`下移分类 ${category.name}`}
              disabled={index === categories.length - 1}
              onClick={() => move(index, 1)}
            >
              <ArrowDown size={16} />
            </button>
          </li>
        ))}
      </ol>
    </fieldset>
  );
}
