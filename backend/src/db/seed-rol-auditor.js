require('dotenv').config();
const prisma = require('./prisma');

async function main() {
  const rol = await prisma.roles.create({
    data: {
      rol_name: 'GERENTE_AUDITOR',
      rol_pass: 'cambiar_esta_clave',
      rol_description: 'Consulta de stock consolidado e historial de movimientos para auditoria',
    },
  });
  console.log('Rol creado:', rol);
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());