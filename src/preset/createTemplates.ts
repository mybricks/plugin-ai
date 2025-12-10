export const createTemplates = {
  page: ({ title }: any) => {
    return {
      type: "normal",
      title: title,
      template: {
        namespace: 'mybricks.harmony.systemPage',
        deletable: false,
        asRoot: true,
        data: {
          useTabBar: false,
        },
      },
      inputs: [
        {
          id: "open",
          title: "打开",
          schema: {
            type: "object",
          },
        },
      ],
    }
  }
}