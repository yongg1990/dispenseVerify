const resourceNames = {
  outpatient: { accept: 'accept', dispense: 'dispense' },
  inpatient: { accept: 'acceptZy', dispense: 'dispenseZy' }
}

function findProject(resources) {
  for (const resource of Array.isArray(resources) ? resources : []) {
    if (resource.actionUrl === 'dispenseVerify' && resource.actionPath === '/dispenseVerify') return resource
    const project = findProject(resource.children)
    if (project) return project
  }
  return null
}

export function loginPermissions(loginInfo) {
  if (Number(loginInfo?.user?.personType) > 0) {
    return { outpatient: { accept: true, dispense: true }, inpatient: { accept: true, dispense: true } }
  }
  const project = findProject(loginInfo?.viewLoginResources)
  const actions = new Set((Array.isArray(project?.children) ? project.children : []).map(row => row.actionUrl))
  return Object.fromEntries(Object.entries(resourceNames).map(([business, names]) => [
    business, Object.fromEntries(Object.entries(names).map(([kind, name]) => [kind, actions.has(name)]))
  ]))
}

export function canUseBusiness(business, session) {
  const permissions = loginPermissions(session?.loginInfo)[business]
  return !!(permissions?.accept || permissions?.dispense)
}

export function canUseAction(kind, business, session) {
  return loginPermissions(session?.loginInfo)[business]?.[kind] === true
}

export function canAccessPage(path, business, session) {
  if (!canUseBusiness(business, session)) return false
  if (['home', 'profile'].includes(path)) return true
  if (['accept', 'accept-records', 'waybill-accept'].includes(path)) return canUseAction('accept', business, session)
  if (['dispense', 'inpatient-dispense', 'dispense-records', 'ward-receive', 'receive-records'].includes(path)) {
    if (['inpatient-dispense', 'ward-receive', 'receive-records'].includes(path) && business !== 'inpatient') return false
    if (path === 'dispense' && business !== 'outpatient') return false
    return canUseAction('dispense', business, session)
  }
  return false
}
