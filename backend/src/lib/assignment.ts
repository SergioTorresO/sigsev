import supabase from './supabase'

// Verifica que el usuario al que se le quiere asignar una inspección/mantenimiento
// tenga uno de los roles permitidos para ese tipo de tarea. Se usa al crear y al
// reasignar (PUT), tanto si quien asigna es ADMIN como SUPERVISOR.
export const assertAssigneeRole = async (userId: string, allowedRoles: string[], taskLabel: string) => {
  const { data: target, error } = await supabase
    .from('users')
    .select('full_name, roles(name)')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!target) throw new Error('El usuario al que intentas asignar la tarea no existe')

  const rolesData = target.roles as unknown as { name: string } | { name: string }[] | null
  const roleName = (Array.isArray(rolesData) ? rolesData[0]?.name : rolesData?.name) ?? ''

  if (!allowedRoles.includes(roleName)) {
    throw new Error(
      `${taskLabel} solo se puede asignar a usuarios con rol ${allowedRoles.join(' o ')} (${target.full_name} tiene el rol ${roleName || 'desconocido'})`
    )
  }
}
