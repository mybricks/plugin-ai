[].map(t => {
  if (t.type === 'updatePage' && t.params[0] === 'u_QIXGy') {
    t.params[0] = 'u_ail3e'
    return {
      ...t,
      delay: 1000,
    }
  }
  return null
}).filter(t => t !== null)