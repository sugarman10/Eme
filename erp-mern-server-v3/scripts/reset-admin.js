import 'dotenv/config'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import connectDB from '../src/config/db.js'
import User from '../src/models/User.js'

async function run() {
    await connectDB()

    // حذف جميع مستخدمي الأدمن القدامى
    const deleted = await User.deleteMany({ role: 'admin' })
    console.log(`🗑️  Deleted ${deleted.deletedCount} admin user(s)`)

    // إنشاء أدمن جديد
    const email = 'admin@example.com'
    const password = 'Admin12345!'
    const name = 'System Administrator'

    const hash = await bcrypt.hash(password, 10)
    const admin = await User.create({
        name,
        email,
        password: hash,
        role: 'admin'
    })

    console.log('✅ Created new admin user:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📧 Email:', email)
    console.log('🔑 Password:', password)
    console.log('👤 Name:', name)
    console.log('🆔 ID:', admin._id.toString())
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    process.exit(0)
}

run().catch(e => {
    console.error('❌ Error:', e.message)
    process.exit(1)
})
