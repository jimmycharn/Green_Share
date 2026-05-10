import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthUser } from '@/lib/auth';

export async function POST(req) {
  const auth = await getAuthUser(req);
  if (!auth || !auth.user) {
    return NextResponse.json({ status: 'error', message: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const folder = formData.get('folder') || 'misc';

    if (!file) {
      return NextResponse.json({ status: 'error', message: 'ไม่พบไฟล์' }, { status: 400 });
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    // Ensure the bucket exists (one-time auto-provision)
    const { data: existing } = await supabaseAdmin.storage.getBucket('shares');
    if (!existing) {
      const { error: bucketErr } = await supabaseAdmin.storage.createBucket('shares', {
        public: true,
        fileSizeLimit: 10 * 1024 * 1024, // 10 MB
      });
      if (bucketErr && !String(bucketErr.message || '').includes('already exists')) {
        throw bucketErr;
      }
    }

    const { data: uploadData, error } = await supabaseAdmin.storage
      .from('shares')
      .upload(fileName, buffer, { contentType: file.type, upsert: false });

    if (error) throw error;

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from('shares').getPublicUrl(uploadData.path);

    return NextResponse.json({ status: 'success', url: publicUrl });
  } catch (error) {
    console.error('[api/upload]', error);
    return NextResponse.json(
      { status: 'error', message: 'อัปโหลดไม่สำเร็จ: ' + error.message },
      { status: 500 }
    );
  }
}
