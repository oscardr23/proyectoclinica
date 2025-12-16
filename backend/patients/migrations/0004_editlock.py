# Generated manually for EditLock model

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('patients', '0003_clinicalrecord_document'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='EditLock',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('locked_at', models.DateTimeField(auto_now_add=True)),
                ('expires_at', models.DateTimeField()),
                ('locked_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='patient_locks', to=settings.AUTH_USER_MODEL)),
                ('patient', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='edit_lock', to='patients.patientprofile')),
            ],
            options={
                'ordering': ['-locked_at'],
            },
        ),
        migrations.AddIndex(
            model_name='editlock',
            index=models.Index(fields=['patient', 'expires_at'], name='patients_ed_patient_5a8f2a_idx'),
        ),
    ]

