import { List } from "./collection";

type Todo = {
  id: number;
  body: string;
  completed: boolean;
};

const seed = (): Todo[] => [
  { id: 1, body: "write tests", completed: false },
  { id: 2, body: "fix queue", completed: true },
  { id: 3, body: "ship it", completed: false },
];

describe("List", () => {
  let list: List<Todo>;

  beforeEach(() => {
    list = List.from(seed());
  });

  it("copies the source array instead of capturing it", () => {
    const source = seed();
    const copied = List.from(source);

    source.push({ id: 99, body: "external", completed: false });

    expect(copied.Count()).toBe(3);
  });

  it("counts its items", () => {
    expect(list.Count()).toBe(3);
    expect(new List<Todo>().Count()).toBe(0);
  });

  describe("Find", () => {
    it("returns every item when no predicate is given", async () => {
      await expect(list.Find()).resolves.toHaveLength(3);
    });

    it("returns only matching items", async () => {
      const done = await list.Find((t) => t.completed);
      expect(done).toHaveLength(1);
      expect(done[0].id).toBe(2);
    });

    it("returns an empty array when nothing matches", async () => {
      await expect(list.Find((t) => t.id === 404)).resolves.toEqual([]);
    });

    it("hands back a copy, so mutating it cannot corrupt the list", async () => {
      const found = await list.Find();
      found.pop();
      expect(list.Count()).toBe(3);
    });
  });

  describe("FindOne", () => {
    it("returns the first match", async () => {
      const todo = await list.FindOne((t) => !t.completed);
      expect(todo?.id).toBe(1);
    });

    it("returns the first item when no predicate is given", async () => {
      const todo = await list.FindOne();
      expect(todo?.id).toBe(1);
    });

    it("resolves to undefined when nothing matches", async () => {
      await expect(list.FindOne((t) => t.id === 404)).resolves.toBeUndefined();
    });

    it("resolves to undefined on an empty list", async () => {
      await expect(new List<Todo>().FindOne()).resolves.toBeUndefined();
    });
  });

  describe("mutation", () => {
    it("adds a single item", () => {
      list.Add({ id: 4, body: "new", completed: false });
      expect(list.Count()).toBe(4);
    });

    it("adds several items", () => {
      list.AddRange([
        { id: 4, body: "a", completed: false },
        { id: 5, body: "b", completed: false },
      ]);
      expect(list.Count()).toBe(5);
    });

    it("removes matching items and reports how many went", () => {
      expect(list.Remove((t) => t.completed)).toBe(1);
      expect(list.Count()).toBe(2);
    });

    it("reports zero when a removal matches nothing", () => {
      expect(list.Remove((t) => t.id === 404)).toBe(0);
      expect(list.Count()).toBe(3);
    });

    it("clears every item", () => {
      expect(list.Clear().Count()).toBe(0);
    });

    it("chains Add and AddRange", () => {
      const built = new List<Todo>()
        .Add({ id: 1, body: "a", completed: false })
        .AddRange([{ id: 2, body: "b", completed: true }]);
      expect(built.Count()).toBe(2);
    });
  });

  describe("Where", () => {
    it("returns a new filtered list", () => {
      const open = list.Where((t) => !t.completed);
      expect(open).toBeInstanceOf(List);
      expect(open.Count()).toBe(2);
    });

    it("leaves the original untouched", () => {
      list.Where((t) => t.completed);
      expect(list.Count()).toBe(3);
    });

    it("chains", () => {
      const result = list
        .Where((t) => !t.completed)
        .Where((t) => t.id > 1);
      expect(result.Count()).toBe(1);
    });
  });

  describe("Any", () => {
    it("reports whether the list holds anything", () => {
      expect(list.Any()).toBe(true);
      expect(new List<Todo>().Any()).toBe(false);
    });

    it("reports whether anything matches", () => {
      expect(list.Any((t) => t.completed)).toBe(true);
      expect(list.Any((t) => t.id === 404)).toBe(false);
    });
  });

  it("ToArray returns a detached copy", () => {
    const arr = list.ToArray();
    arr.pop();
    expect(list.Count()).toBe(3);
  });
});
