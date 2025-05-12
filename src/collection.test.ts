import Container from "typedi";
import { CreateConfig, GetConfig } from "./config";
import { BasicCollection, Collection } from "./collection";

type Todo = {
  id: number;
  body: string;
  completed: boolean;
};

describe("Collection", () => {
  let collection!: BasicCollection<Todo>;
  beforeEach(() => {
    collection = Collection.from<Todo>([
      {
        id: 1,
        body: "test 1",
        completed: false,
      },
      {
        id: 2,
        body: "test 2",
        completed: true,
      },
      {
        id: 3,
        body: "test 2",
        completed: true,
      },
    ]);
  });

  afterEach(() => {
    collection.clear();
  });

  describe("find()", () => {
    it("should be return collection", () => {
      const result = collection.find();
      expect(result).toHaveProperty("length");
      expect(result.length).toBe(3);
    });

    it("should return only completed task", () => {
      const result = collection.find((todo) => todo.completed);
      expect(result).toHaveProperty("length");
      expect(result.length).toBe(2);
      expect(result[0].id).toBe(2);
    });
  });

  describe("findOne()", () => {
    it("should be return todo", () => {
      const result = collection.findOne({ where: { id: 1 } });
      expect(result).toHaveProperty("id");
      expect(result?.id).toBe(1);
    });

    it("should return only completed task", () => {
      const result = collection.findOne({
        where: {
          id: {
            $in: [3],
          },
        },
      });
      expect(result).toHaveProperty("id");
      expect(result?.completed).toBe(true);
    });
  });
});
