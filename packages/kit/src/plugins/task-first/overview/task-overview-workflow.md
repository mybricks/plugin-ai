# 任务总览

维护任务时，同步维护与当前任务文档 `TASKS.md` 同目录下的 `overview.yaml`。不要自行推断分支或使用其他分支的文件。

总览展示全局入口、页面、组件及其关联任务。任务内容和状态以 `TASKS.md` 为准，总览只引用任务 ID。

核心目标是以 任务文档的视角 来帮助理解影响的组件和页面的关系，最终会以思维导图的形式呈现。

## 维护思路
重要准则：任务总览思维导图必须反映真实代码和任务的情况
1. 思维导图也就是 `overview.yaml` 必须真实反映任务列表和真实代码的情况，特别是组件数量、页面数量，每一次迭代、完成任务，根据迭代代码的变更信息来维护思维导图。
2. 组件用 `parent` 声明直接父节点，归属不明时暂不填写。
3. 任务尽量关联到实际受影响的组件；影响多个组件时逐一关联。组件任务不必重复关联到页面。只有无法确定具体组件或任务作用于页面、全局入口时，关联对应的页面或 `root`。
4. 保留既有稳定 ID、人工补充内容和其他任务关联；任务删除时移除对应 ID。总览仅表达层级和关系。

## 节点维护
> 注意，思维导图无需维护所有的页面和组件、只需要维护任务相关的的页面和组件即可，特别是父子引用关系。

如何定义任务相关？
1. 修改的代码，从子组件开始，影响一层层的父级节点，这一条链路上的节点都需要绘制；
2. 修改的代码，影响了一个通用组件，被多个节点引用，这多个节点链路上的节点都需要绘制；

## YAML 格式

使用以下结构维护任务总览思维导图：

```yaml
version: 2
root:
  title: 用户中心
pages:
  - id: profile
    title: 个人资料页
    file: pages/Profile/index.tsx
  - id: settings
    title: 设置页
    file: pages/Settings/index.tsx
components:
  - id: profile-card
    title: 个人资料卡
    file: components/ProfileCard/index.tsx
    symbol: ProfileCard
    parent: profile
  - id: avatar
    title: 头像组件
    file: components/Avatar/index.tsx
    symbol: Avatar
    parent: [profile-card, settings]
    tasks: [T-001]
```

- `version` 固定为 `2`。`root` 包含全局入口 `title`，所有页面挂在全局入口下。`pages`、`components` 均为数组，暂无内容时使用空数组。
- 页面和组件均有稳定且全局唯一的 `id`、`title`，ID 无需类型前缀。`root` 保留为全局入口的 ID。`file` 为已确认的项目相对源码路径，可选 `symbol` 区分同一文件中的不同组件。
- `parent` 写一个父节点 ID 或多个 ID 的数组。全局入口直接使用的组件写 `parent: root`。有中间组件时，沿真实父子层级逐层关联。
- `tasks` 引用当前 `TASKS.md` 中的任务 ID。复用组件在各处共享自己的任务关联。
- 写入前检查组件引用、任务 ID 和 ID 唯一性，确保层级没有循环引用。
