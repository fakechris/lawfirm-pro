import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seeding...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.create({
    data: {
      email: 'admin@lawfirmpro.com',
      username: 'admin',
      password: adminPassword,
      firstName: 'System',
      lastName: 'Administrator',
      phone: '+86-138-0000-0000',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });

  // Create sample lawyers
  const lawyerPassword = await bcrypt.hash('lawyer123', 10);
  const lawyer1 = await prisma.user.create({
    data: {
      email: 'zhang.wei@lawfirmpro.com',
      username: 'zhang.wei',
      password: lawyerPassword,
      firstName: '张',
      lastName: '伟',
      phone: '+86-138-0000-0001',
      role: 'LAWYER',
      status: 'ACTIVE',
    },
  });

  const lawyer2 = await prisma.user.create({
    data: {
      email: 'li.ming@lawfirmpro.com',
      username: 'li.ming',
      password: lawyerPassword,
      firstName: '李',
      lastName: '明',
      phone: '+86-138-0000-0002',
      role: 'LAWYER',
      status: 'ACTIVE',
    },
  });

  // Create paralegal
  const paralegalPassword = await bcrypt.hash('paralegal123', 10);
  const paralegal = await prisma.user.create({
    data: {
      email: 'wang.fang@lawfirmpro.com',
      username: 'wang.fang',
      password: paralegalPassword,
      firstName: '王',
      lastName: '芳',
      phone: '+86-138-0000-0003',
      role: 'PARALEGAL',
      status: 'ACTIVE',
    },
  });

  // Create assistants
  const assistantPassword = await bcrypt.hash('assistant123', 10);
  const researchAssistant = await prisma.user.create({
    data: {
      email: 'chen.xiao@lawfirmpro.com',
      username: 'chen.xiao',
      password: assistantPassword,
      firstName: '陈',
      lastName: '晓',
      phone: '+86-138-0000-0004',
      role: 'ASSISTANT',
      assistantType: 'RESEARCH_ASSISTANT',
      status: 'ACTIVE',
    },
  });

  const documentAssistant = await prisma.user.create({
    data: {
      email: 'liu.jie@lawfirmpro.com',
      username: 'liu.jie',
      password: assistantPassword,
      firstName: '刘',
      lastName: '杰',
      phone: '+86-138-0000-0005',
      role: 'ASSISTANT',
      assistantType: 'DOCUMENT_ASSISTANT',
      status: 'ACTIVE',
    },
  });

  // Create sample clients
  const client1 = await prisma.client.create({
    data: {
      firstName: '王',
      lastName: '小明',
      email: 'wang.xiaoming@example.com',
      phone: '+86-139-0000-0001',
      address: '北京市朝阳区建国门外大街1号',
      company: '北京科技有限公司',
      idNumber: '110105199001011234',
    },
  });

  const client2 = await prisma.client.create({
    data: {
      firstName: '李',
      lastName: '华',
      email: 'li.hua@example.com',
      phone: '+86-139-0000-0002',
      address: '上海市浦东新区陆家嘴环路1000号',
      company: '上海贸易公司',
      idNumber: '310115199002022345',
    },
  });

  // Create sample cases
  const case1 = await prisma.case.create({
    data: {
      caseNumber: 'LF-2024-001',
      title: '劳动合同纠纷案',
      description: '员工与公司之间的劳动合同纠纷，涉及加班费和经济补偿金',
      caseType: 'LABOR_DISPUTE',
      phase: 'INTAKE_RISK_ASSESSMENT',
      status: 'ACTIVE',
      startDate: new Date('2024-01-15'),
      expectedEndDate: new Date('2024-06-15'),
      claimAmount: 150000,
      clientId: client1.id,
      leadLawyerId: lawyer1.id,
      phases: {
        create: [
          {
            phase: 'INTAKE_RISK_ASSESSMENT',
            startDate: new Date('2024-01-15'),
            notes: '初步接案，了解基本情况'
          }
        ]
      },
      teamMembers: {
        create: [
          {
            userId: lawyer1.id,
            role: 'LEAD_LAWYER'
          },
          {
            userId: paralegal.id,
            role: 'PARTICIPATING_LAWYER'
          },
          {
            userId: researchAssistant.id,
            role: 'RESEARCH_ASSISTANT'
          }
        ]
      }
    },
  });

  const case2 = await prisma.case.create({
    data: {
      caseNumber: 'LF-2024-002',
      title: '合同纠纷案',
      description: '买卖合同纠纷，涉及货物质量问题和违约金',
      caseType: 'CONTRACT_DISPUTE',
      phase: 'PRE_PROCEEDING_PREP',
      status: 'ACTIVE',
      startDate: new Date('2024-02-01'),
      expectedEndDate: new Date('2024-08-01'),
      claimAmount: 500000,
      clientId: client2.id,
      leadLawyerId: lawyer2.id,
      phases: {
        create: [
          {
            phase: 'INTAKE_RISK_ASSESSMENT',
            startDate: new Date('2024-02-01'),
            endDate: new Date('2024-02-15'),
            notes: '完成初步风险评估'
          },
          {
            phase: 'PRE_PROCEEDING_PREP',
            startDate: new Date('2024-02-16'),
            notes: '开始诉前准备'
          }
        ]
      },
      teamMembers: {
        create: [
          {
            userId: lawyer2.id,
            role: 'LEAD_LAWYER'
          },
          {
            userId: documentAssistant.id,
            role: 'DOCUMENT_ASSISTANT'
          }
        ]
      }
    },
  });

  // Create sample tasks
  await prisma.task.create({
    data: {
      title: '收集证据材料',
      description: '收集劳动合同、工资单、加班记录等证据材料',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      dueDate: new Date('2024-02-01'),
      caseId: case1.id,
      assigneeId: paralegal.id,
      createdById: lawyer1.id,
    },
  });

  await prisma.task.create({
    data: {
      title: '法律研究',
      description: '研究相关劳动法律法规和类似案例',
      status: 'COMPLETED',
      priority: 'MEDIUM',
      dueDate: new Date('2024-01-25'),
      completedAt: new Date('2024-01-24'),
      caseId: case1.id,
      assigneeId: researchAssistant.id,
      createdById: lawyer1.id,
    },
  });

  await prisma.task.create({
    data: {
      title: '起草起诉状',
      description: '根据案件情况起草起诉状',
      status: 'PENDING',
      priority: 'HIGH',
      dueDate: new Date('2024-02-10'),
      caseId: case2.id,
      assigneeId: documentAssistant.id,
      createdById: lawyer2.id,
    },
  });

  // Create sample fees
  await prisma.fee.create({
    data: {
      description: '律师代理费（劳动纠纷案件）',
      amount: 30000,
      method: 'FIXED_FEE',
      status: 'PENDING',
      dueDate: new Date('2024-02-15'),
      caseId: case1.id,
      clientId: client1.id,
    },
  });

  await prisma.fee.create({
    data: {
      description: '律师代理费（合同纠纷案件）',
      amount: 80000,
      method: 'PERCENTAGE',
      status: 'DRAFT',
      dueDate: new Date('2024-03-01'),
      caseId: case2.id,
      clientId: client2.id,
    },
  });

  // Create sample time entries
  await prisma.timeEntry.create({
    data: {
      description: '初次客户咨询',
      hours: 2,
      rate: 500,
      date: new Date('2024-01-15'),
      caseId: case1.id,
      userId: lawyer1.id,
    },
  });

  await prisma.timeEntry.create({
    data: {
      description: '案件研究与分析',
      hours: 3,
      rate: 300,
      date: new Date('2024-01-16'),
      caseId: case1.id,
      userId: paralegal.id,
    },
  });

  // Create sample notes
  await prisma.note.create({
    data: {
      title: '案件初步评估',
      content: '客户提供的证据较为充分，胜诉可能性较大。需要进一步收集加班证据。',
      isPrivate: false,
      caseId: case1.id,
      userId: lawyer1.id,
    },
  });

  await prisma.note.create({
    data: {
      title: '客户沟通记录',
      content: '客户对案件进展表示满意，希望能够尽快解决。',
      isPrivate: false,
      caseId: case1.id,
      userId: paralegal.id,
    },
  });

  console.log('Database seeding completed successfully!');
  console.log('Created users:', { admin, lawyer1, lawyer2, paralegal, researchAssistant, documentAssistant });
  console.log('Created clients:', { client1, client2 });
  console.log('Created cases:', { case1, case2 });
}

main()
  .catch((e) => {
    console.error('Error during database seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });