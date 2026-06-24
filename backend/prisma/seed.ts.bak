import prisma from '../src/lib/prisma'

const roles = [
  {
    name: 'ADMIN',
    description: 'Acceso administrativo completo',
  },
  {
    name: 'SUPERVISOR',
    description: 'Gestiona inspecciones, mantenimientos y reportes',
  },
  {
    name: 'TECNICO',
    description: 'Registra inspecciones y evidencias en campo',
  },
  {
    name: 'CONSULTA',
    description: 'Acceso basico de consulta',
  },
]

const main = async () => {
  for (const role of roles) {
    await prisma.roles.upsert({
      where: {
        name: role.name,
      },
      update: {
        description: role.description,
      },
      create: role,
    })
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
