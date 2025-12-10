from decimal import Decimal

from rest_framework import serializers

from .models import Budget, Invoice, InvoiceItem, Service
from patients.serializers import PatientSerializer
from staff.serializers import ProfessionalSerializer


class ServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = ['id', 'name', 'description', 'base_price', 'is_active']


class InvoiceItemSerializer(serializers.ModelSerializer):
    service_detail = ServiceSerializer(source='service', read_only=True)

    class Meta:
        model = InvoiceItem
        fields = ['id', 'service', 'service_detail', 'quantity', 'unit_price']


class InvoiceSerializer(serializers.ModelSerializer):
    patient = PatientSerializer(read_only=True)
    patient_id = serializers.PrimaryKeyRelatedField(
        queryset=Invoice._meta.get_field('patient').remote_field.model.objects.all(),
        source='patient',
        write_only=True,
    )
    items = InvoiceItemSerializer(many=True)
    effective_status = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = [
            'id',
            'patient',
            'patient_id',
            'issued_by',
            'status',
            'effective_status',
            'issued_at',
            'due_date',
            'notes',
            'total',
            'items',
        ]
        read_only_fields = ('issued_by', 'issued_at', 'total', 'effective_status')

    def get_effective_status(self, obj):
        """Devuelve el estado efectivo (incluyendo OVERDUE si corresponde)"""
        return obj.get_effective_status()

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        invoice = Invoice.objects.create(**validated_data)
        self._sync_items(invoice, items_data)
        invoice.recalculate_total()
        return invoice

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if items_data is not None:
            instance.items.all().delete()
            self._sync_items(instance, items_data)
        instance.recalculate_total()
        return instance

    def _sync_items(self, invoice, items_data):
        for item in items_data:
            InvoiceItem.objects.create(
                invoice=invoice,
                service=item['service'],
                quantity=item.get('quantity', 1),
                unit_price=item.get('unit_price') or item['service'].base_price,
            )


class BudgetSerializer(serializers.ModelSerializer):
    patient = PatientSerializer(read_only=True)
    patient_id = serializers.PrimaryKeyRelatedField(
        queryset=Budget._meta.get_field('patient').remote_field.model.objects.all(),
        source='patient',
        write_only=True,
    )
    professional = ProfessionalSerializer(read_only=True)
    professional_id = serializers.PrimaryKeyRelatedField(
        queryset=Budget._meta.get_field('professional').remote_field.model.objects.all(),
        source='professional',
        write_only=True,
    )

    class Meta:
        model = Budget
        fields = [
            'id',
            'patient',
            'patient_id',
            'professional',
            'professional_id',
            'description',
            'estimated_cost',
            'status',
            'created_at',
        ]
        read_only_fields = ('created_at',)

