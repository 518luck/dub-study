import { CardList as CardListComponent, CardListContext } from "./card-list";
import { CardContext, CardListCard } from "./card-list-card";

// 这里用的是一种常见的工程化组织方式：
// “组件族命名空间” / compound components / namespaced API。
//
// 它不是在写业务逻辑，而是在把分散的成员重新整理成一个统一出口。
// 最终希望调用方这样使用：
// - CardList
// - CardList.Card
// - CardList.Context
// - CardList.Card.Context
//
// 为什么要这么做：
// 1. 把强相关的组件、子组件、Context 收拢到同一个名字下面，减少顶层平铺导出。
// 2. 让 API 更有层次，看到 CardList.Card 就知道它属于 CardList 这套组件。
// 3. 方便后续继续扩展，比如以后还能加 CardList.Header、CardList.Empty 等，而不必新增很多零散导出。
//
// 这么做的好处：
// - 使用时更直观：<CardList><CardList.Card /></CardList>
// - 语义分组更清晰：相关能力都挂在 CardList 名下
// - 组件库更易维护：对外暴露的是一个“组件家族”，不是很多互相独立的名字
//
// Object.assign(target, source1, source2, ...)
// 它的作用是：把 source1、source2 等对象的属性复制到 target 上，然后返回 target。
//
// 这里之所以能这么写，是因为 React 组件本质上是 JavaScript 函数，
// 而函数在 JS 里也是对象，所以可以像普通对象一样挂属性。
//
// 可以把下面这段近似理解成：
// CardList.Context = CardListContext
// CardList.Card = CardListCard
// CardList.Card.Context = CardContext
const CardList = Object.assign(CardListComponent, {
  Card: Object.assign(CardListCard, {
    Context: CardContext,
  }),
  Context: CardListContext,
});

export { CardList };
